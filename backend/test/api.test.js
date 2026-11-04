// API integration tests: real Express app + in-memory MongoDB, exercised over HTTP.
process.env.NODE_ENV = 'test';

const { test, before, after, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const { seedData } = require('../src/seed');
const Order = require('../src/models/Order');
const FoodItem = require('../src/models/FoodItem');
const { getWeekMonday, getDaysForWeek } = require('../src/utils/weekUtils');

let mongo;
let server;
let baseUrl;

const call = async (method, path, { token, body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const login = async (email, password) =>
  (await call('POST', '/api/auth/login', { body: { email, password } })).body.accessToken;

const weekPlus = (n) => {
  const monday = getWeekMonday(new Date());
  monday.setDate(monday.getDate() + n * 7);
  return monday;
};
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The week under test, and moments around it: the manager sets its menu Sunday M-8 → Monday M-7,
// customers order Wednesday M-5 → Thursday M-4.
const M = weekPlus(2);
const dayFrom = (offset, hour = 10) => {
  const d = new Date(M);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const SATURDAY_BEFORE_MENU = dayFrom(-9);
const MENU_SUNDAY = dayFrom(-8);
const TUESDAY = dayFrom(-6);
const ORDER_WEDNESDAY = dayFrom(-5);
const FRIDAY_AFTER = dayFrom(-3);

let adminToken;
let customerToken;
let dishes;
let slots;

/** Freeze the clock at `date` and sign in again (tokens are short-lived). */
const at = async (date) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: date });
  adminToken = await login('admin@puttumkadalayum.com.au', 'Admin123!');
  customerToken = await login('customer@example.com', 'Customer123!');
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const log = console.log;
  console.log = () => {}; // silence seed banner
  await seedData(false);
  console.log = log;

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login('admin@puttumkadalayum.com.au', 'Admin123!');
  customerToken = await login('customer@example.com', 'Customer123!');

  dishes = (await call('GET', '/api/admin/food-items', { token: adminToken })).body.data;
  slots = (await call('GET', '/api/admin/pickup-slots', { token: adminToken })).body.data;
});

after(async () => {
  mock.timers.reset();
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

// The week M menu: Monday has dishes 0, 1, 2; Tuesday has dish 3; the rest are closed
const menuDays = () =>
  getDaysForWeek(M).map(({ dayName }) => ({
    dayName,
    dishes: dayName === 'Monday' ? [dishes[0]._id, dishes[1]._id, dishes[2]._id] : dayName === 'Tuesday' ? [dishes[3]._id] : [],
  }));

const saveMenu = (token, days, monday = M) =>
  call('PUT', '/api/admin/menu', { token, body: { weekStartDate: isoDay(monday), days } });

// Seven days of week M with nothing ordered, picked up in the midday window unless overridden
const week = (overrides = {}) =>
  getDaysForWeek(M).map((d) => ({
    dayName: d.dayName,
    items: [],
    pickupSlot: slots[1]._id,
    ...(overrides[d.dayName] || {}),
  }));
const item = (dish, quantity = 1) => ({ foodItem: dish._id, quantity });

const saveWeek = (token, days, monday = M) =>
  call('POST', '/api/customer/selection/week', {
    token,
    body: { weekStartDate: isoDay(monday), days },
  });

describe('auth & access control', () => {
  test('health check responds', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
  });

  test('rejects wrong password', async () => {
    const res = await call('POST', '/api/auth/login', {
      body: { email: 'customer@example.com', password: 'nope-nope' },
    });
    assert.equal(res.status, 401);
  });

  test('anonymous users cannot register an admin', async () => {
    const res = await call('POST', '/api/auth/admin/register', {
      body: { name: 'Mallory', email: 'mallory@evil.test', password: 'password123' },
    });
    assert.equal(res.status, 401);
  });

  test('customers cannot register an admin', async () => {
    const res = await call('POST', '/api/auth/admin/register', {
      token: customerToken,
      body: { name: 'Mallory', email: 'mallory@evil.test', password: 'password123' },
    });
    assert.equal(res.status, 403);
  });

  test('an existing admin can register another admin', async () => {
    const res = await call('POST', '/api/auth/admin/register', {
      token: adminToken,
      body: { name: 'Second Owner', email: 'owner2@puttumkadalayum.com.au', password: 'password123' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'admin');
  });

  test('customers cannot reach admin routes', async () => {
    const res = await call('GET', '/api/admin/dashboard', { token: customerToken });
    assert.equal(res.status, 403);
  });

  test('a forged token is rejected', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'admin' }, 'a_guessed_or_leaked_secret');
    const res = await call('GET', '/api/admin/dashboard', { token: forged });
    assert.equal(res.status, 401);
  });

  test('short passwords are rejected at registration', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { name: 'Shorty', email: 'short@example.com', password: 'abc' },
    });
    assert.equal(res.status, 400);
  });
});

describe('weekly menu (manager)', () => {
  test('cannot be set before Sunday', async () => {
    await at(SATURDAY_BEFORE_MENU);
    const res = await saveMenu(adminToken, menuDays());
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'MENU_NOT_OPEN');
  });

  test('on Sunday the manager is setting the week after next', async () => {
    await at(MENU_SUNDAY);
    const res = await call('GET', '/api/admin/menu', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(new Date(res.body.data.weekStartDate).getTime(), M.getTime());
    assert.equal(res.body.data.isOpen, true);
  });

  test('allows at most 3 dishes a day', async () => {
    await at(MENU_SUNDAY);
    const days = menuDays();
    days[0].dishes = dishes.slice(0, 4).map((d) => d._id);
    const res = await saveMenu(adminToken, days);
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'DAY_LIMIT');
  });

  test('customers cannot set the menu', async () => {
    await at(MENU_SUNDAY);
    const res = await saveMenu(customerToken, menuDays());
    assert.equal(res.status, 403);
  });

  test('saves up to 3 dishes per day', async () => {
    await at(MENU_SUNDAY);
    const res = await saveMenu(adminToken, menuDays());
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.data.days[0].dishes.length, 3);
    assert.equal(res.body.data.days[2].dishes.length, 0);
  });

  test('is locked after Monday night', async () => {
    await at(TUESDAY);
    const res = await saveMenu(adminToken, menuDays());
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'MENU_LOCKED');
  });
});

describe('ordering meals (customer)', () => {
  const price = (i) => dishes[i].price;

  test('anyone can see each day\'s dishes, with prices', async () => {
    await at(TUESDAY);
    const res = await call('GET', '/api/customer/week');
    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.equal(new Date(data.weekStartDate).getTime(), M.getTime());
    assert.equal(data.menuDays[0].dishes.length, 3);
    assert.equal(data.menuDays[0].dishes[0].price, price(0));
    assert.equal(data.menuDays[2].dishes.length, 0);
    assert.equal(data.isOpen, false);
    assert.equal(data.selection, null);
  });

  test('ordering does not open until Wednesday', async () => {
    await at(TUESDAY);
    const res = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0])] } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SELECTION_NOT_OPEN');
  });

  test('saves quantities with one pickup time per day, bills the prices, and creates orders', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await saveWeek(
      customerToken,
      week({
        Monday: { items: [item(dishes[0], 2), item(dishes[1])] },
        Tuesday: { items: [item(dishes[3])], pickupSlot: slots[2]._id },
      })
    );
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.data.totalAUD, 2 * price(0) + price(1) + price(3));
    assert.equal(res.body.data.payment.status, 'unpaid');

    const orders = await Order.find({ status: 'pending', date: { $gte: M } }).sort({ date: 1, mealNumber: 1 });
    assert.deepEqual(orders.map((o) => o.mealNumber), [1, 2, 3, 1]);
    assert.equal(String(orders[0].foodItem), String(dishes[0]._id));
    assert.equal(String(orders[1].foodItem), String(dishes[0]._id));
    assert.equal(String(orders[3].pickupSlot), String(slots[2]._id));
  });

  test('a day can be left empty, and fewer meals removes orders', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[2])], pickupSlot: slots[0]._id } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.totalAUD, price(2));
    const orders = await Order.find({ status: 'pending', date: { $gte: M } });
    assert.equal(orders.length, 1);
    assert.equal(String(orders[0].pickupSlot), String(slots[0]._id));
  });

  test('more than 3 meals a day is rejected', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0], 2), item(dishes[1], 2)] } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'DAY_LIMIT');
  });

  test('only that day\'s dishes can be ordered', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await saveWeek(customerToken, week({ Tuesday: { items: [item(dishes[0])] } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'NOT_ON_MENU');
  });

  test('a pickup time is required for days with meals', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0])], pickupSlot: null } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PICKUP_REQUIRED');
  });

  test('rejects a sold-out dish', async () => {
    await at(ORDER_WEDNESDAY);
    await FoodItem.updateOne({ _id: dishes[0]._id }, { isAvailable: false });
    const res = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0])] } }));
    await FoodItem.updateOne({ _id: dishes[0]._id }, { isAvailable: true });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /no longer available/);
  });

  test('orders close after Thursday night', async () => {
    await at(FRIDAY_AFTER);
    const res = await saveWeek(customerToken, week());
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SELECTION_LOCKED');
  });
});

describe('bills & offline payments', () => {
  let billId;

  test('the manager sees each customer\'s bill for the week', async () => {
    await at(ORDER_WEDNESDAY);
    await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0], 2)] }, Tuesday: { items: [item(dishes[3])] } }));

    const res = await call('GET', '/api/admin/bills', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(new Date(res.body.data.weekStartDate).getTime(), M.getTime());
    assert.equal(res.body.data.bills.length, 1);
    const bill = res.body.data.bills[0];
    assert.equal(bill.customer.name, 'Demo Customer');
    assert.equal(bill.totalAUD, 2 * dishes[0].price + dishes[3].price);
    assert.equal(bill.days[0].items[0].foodItem.name, dishes[0].name);
    assert.equal(res.body.data.summary.unpaidAUD, bill.totalAUD);
    billId = bill._id;

    const dashboard = await call('GET', '/api/admin/dashboard', { token: adminToken });
    assert.equal(dashboard.body.stats.unpaidBills, 1);
  });

  test('customers cannot mark their own bill paid', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await call('PUT', `/api/admin/bills/${billId}/payment`, { token: customerToken, body: { paid: true, method: 'cash' } });
    assert.equal(res.status, 403);
  });

  test('rejects an unknown payment method', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await call('PUT', `/api/admin/bills/${billId}/payment`, { token: adminToken, body: { paid: true, method: 'bitcoin' } });
    assert.equal(res.status, 400);
  });

  test('the manager marks a bill paid', async () => {
    await at(ORDER_WEDNESDAY);
    const res = await call('PUT', `/api/admin/bills/${billId}/payment`, {
      token: adminToken,
      body: { paid: true, method: 'bank_transfer', reference: 'CBA 1234' },
    });
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.data.payment.status, 'paid');
    assert.equal(res.body.data.payment.reference, 'CBA 1234');

    const mine = await call('GET', '/api/customer/bills', { token: customerToken });
    assert.equal(mine.body.data[0].payment.status, 'paid');
  });

  test('re-saving the same order keeps it paid; changing the total makes it unpaid', async () => {
    await at(ORDER_WEDNESDAY);
    const same = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0], 2)] }, Tuesday: { items: [item(dishes[3])] } }));
    assert.equal(same.body.data.payment.status, 'paid');

    const changed = await saveWeek(customerToken, week({ Monday: { items: [item(dishes[0])] } }));
    assert.equal(changed.body.data.payment.status, 'unpaid');
  });
});

describe('admin', () => {
  before(() => mock.timers.reset());

  test('food item updates ignore non-editable fields', async () => {
    adminToken = await login('admin@puttumkadalayum.com.au', 'Admin123!');
    const item = await FoodItem.findOne().lean();
    const attacker = new mongoose.Types.ObjectId();
    const res = await call('PUT', `/api/admin/food-items/${item._id}`, {
      token: adminToken,
      body: { name: 'Chicken Biriyani (Large)', price: 18.5, createdBy: attacker },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Chicken Biriyani (Large)');
    assert.equal(res.body.data.price, 18.5);
    assert.equal(res.body.data.createdBy, String(item.createdBy));
  });

  test('prices cannot be negative', async () => {
    const item = await FoodItem.findOne().lean();
    const res = await call('PUT', `/api/admin/food-items/${item._id}`, { token: adminToken, body: { price: -2 } });
    assert.equal(res.status, 400);
  });

  test('dishes can be added with a price', async () => {
    const res = await call('POST', '/api/admin/food-items', {
      token: adminToken,
      body: { name: 'Porotta and Beef Fry', dietType: 'non-veg', price: 16 },
    });
    assert.equal(res.status, 201, res.body.message);
    assert.equal(res.body.data.price, 16);
  });

  test('order statuses follow the pickup flow', async () => {
    const order = await Order.findOne({ status: 'pending' });
    for (const status of ['preparing', 'ready', 'collected']) {
      const res = await call('PUT', `/api/admin/orders/${order._id}/status`, { token: adminToken, body: { status } });
      assert.equal(res.status, 200, status);
    }
    const bad = await call('PUT', `/api/admin/orders/${order._id}/status`, {
      token: adminToken,
      body: { status: 'out_for_delivery' },
    });
    assert.equal(bad.status, 400);
  });

  test('orders list is grouped by pickup window', async () => {
    const res = await call('GET', `/api/admin/orders?date=${isoDay(M)}`, { token: adminToken });
    assert.equal(res.status, 200);
    const times = res.body.data.map((o) => o.pickupSlot.startTime);
    assert.deepEqual(times, [...times].sort());
  });

  test('manager can add a pickup window', async () => {
    const res = await call('POST', '/api/admin/pickup-slots', {
      token: adminToken,
      body: { label: 'Late (8:00 – 9:00 PM)', startTime: '20:00', endTime: '21:00' },
    });
    assert.equal(res.status, 201, res.body.message);
  });
});
