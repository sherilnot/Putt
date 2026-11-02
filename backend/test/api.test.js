// API integration tests: real Express app + in-memory MongoDB, exercised over HTTP.
process.env.NODE_ENV = 'test';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const { seedData } = require('../src/seed');
const Order = require('../src/models/Order');
const FoodItem = require('../src/models/FoodItem');
const {
  getWeekMonday,
  getDaysForWeek,
  getFirstOpenWeekMonday,
} = require('../src/utils/weekUtils');

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

// Week +2 is never past its Thursday cutoff, whatever day the tests run on.
const weekPlus = (n) => {
  const monday = getWeekMonday(new Date());
  monday.setDate(monday.getDate() + n * 7);
  return monday;
};
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let adminToken;
let customerToken;
let dishes; // { breakfast: [..], lunch: [..], dinner: [..] }
let slots;
const futureMonday = weekPlus(2);

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const log = console.log;
  console.log = () => {}; // silence seed banner
  await seedData(false);
  console.log = log;

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  adminToken = await login('admin@puttumbeefum.com.au', 'Admin123!');
  customerToken = await login('andi@example.com.au', 'Customer123!');

  const items = await FoodItem.find().lean();
  dishes = {
    breakfast: items.filter((i) => i.category === 'breakfast'),
    lunch: items.filter((i) => i.category === 'lunch'),
    dinner: items.filter((i) => i.category === 'dinner'),
  };
  slots = (await call('GET', '/api/customer/delivery-slots')).body.data;

  await publishMenu(futureMonday);
});

// Admin publishes a menu for a week that offers only the FIRST dish of each meal time
const publishMenu = async (monday) => {
  const days = getDaysForWeek(monday).map((d) => ({
    dayName: d.dayName,
    meals: ['breakfast', 'lunch', 'dinner'].map((m) => ({
      mealTime: m,
      foodItems: [dishes[m][0]._id],
    })),
  }));
  const draft = await call('POST', '/api/admin/weekly-menu/save-draft', {
    token: adminToken,
    body: { weekStartDate: isoDay(monday), days },
  });
  assert.equal(draft.status, 200);
  const published = await call('POST', '/api/admin/weekly-menu/publish', {
    token: adminToken,
    body: { menuId: draft.body.data._id },
  });
  assert.equal(published.status, 200);
};

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

const selection = (overrides = {}, monday = futureMonday) =>
  getDaysForWeek(monday).map((d) => ({
    dayName: d.dayName,
    breakfast: null,
    lunch: null,
    dinner: null,
    deliverySlot: slots[1]._id,
    ...(overrides[d.dayName] || {}),
  }));

describe('auth & access control', () => {
  test('health check responds', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
  });

  test('rejects wrong password', async () => {
    const res = await call('POST', '/api/auth/login', {
      body: { email: 'andi@example.com.au', password: 'nope-nope' },
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
      body: { name: 'Second Owner', email: 'owner2@puttumbeefum.com.au', password: 'password123' },
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
    const forged = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'admin' }, 'puttum_beefum_jwt_secret_dev_key');
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

describe('weekly meal selection', () => {
  test('rejects a dish that is not on that day\'s menu', async () => {
    const offMenu = dishes.lunch[1]._id; // only lunch[0] is on the week +2 menu
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: { weekStartDate: isoDay(futureMonday), selections: selection({ Monday: { lunch: offMenu } }) },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /not on the Monday lunch menu/);
  });

  test('rejects an unavailable dish', async () => {
    await FoodItem.updateOne({ _id: dishes.dinner[0]._id }, { isAvailable: false });
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: {
        weekStartDate: isoDay(futureMonday),
        selections: selection({ Monday: { dinner: dishes.dinner[0]._id } }),
      },
    });
    await FoodItem.updateOne({ _id: dishes.dinner[0]._id }, { isAvailable: true });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /unavailable/);
  });

  test('rejects a week with no published menu', async () => {
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: { weekStartDate: isoDay(weekPlus(3)), selections: [] },
    });
    assert.equal(res.status, 404);
  });

  test('rejects changes to a week whose Thursday cutoff has passed', async () => {
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: { weekStartDate: isoDay(weekPlus(0)), selections: [] },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SELECTION_LOCKED');
  });

  test('single-meal edits cannot bypass the weekly cutoff', async () => {
    const res = await call('PUT', '/api/customer/subscription/meal', {
      token: customerToken,
      body: {
        date: isoDay(weekPlus(0)),
        mealTime: 'lunch',
        foodItemId: dishes.lunch[0]._id,
        deliverySlotId: slots[1]._id,
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SELECTION_LOCKED');
  });

  test('saves valid choices, creates orders, and returns them on reload', async () => {
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: {
        weekStartDate: isoDay(futureMonday),
        selections: selection({
          Monday: { breakfast: dishes.breakfast[0]._id, lunch: dishes.lunch[0]._id },
          Tuesday: { dinner: dishes.dinner[0]._id },
        }),
      },
    });
    assert.equal(res.status, 200, res.body.message);

    const orders = await Order.find({ status: 'pending', date: { $gte: futureMonday } });
    assert.equal(orders.length, 3);

    // Previously always null because the route never saw the token
    const menu = await call('GET', `/api/customer/menu/upcoming?weekStartDate=${isoDay(futureMonday)}`, {
      token: customerToken,
    });
    assert.ok(menu.body.data.customerSelection, 'customer selection should be returned');
    const monday = menu.body.data.customerSelection.selections.find((s) => s.dayName === 'Monday');
    assert.equal(monday.lunch._id, String(dishes.lunch[0]._id));
  });

  test('clearing a meal removes its pending order', async () => {
    const res = await call('POST', '/api/customer/selection/week', {
      token: customerToken,
      body: {
        weekStartDate: isoDay(futureMonday),
        selections: selection({ Monday: { lunch: dishes.lunch[0]._id } }),
      },
    });
    assert.equal(res.status, 200);
    const orders = await Order.find({ status: 'pending', date: { $gte: futureMonday } });
    assert.equal(orders.length, 1);
    assert.equal(orders[0].mealTime, 'lunch');
  });

  test('upcoming menu does not fall back to some other week', async () => {
    const res = await call('GET', `/api/customer/menu/upcoming?weekStartDate=${isoDay(weekPlus(3))}`);
    assert.equal(res.body.data.menu, null);
    assert.equal(res.body.data.isPublished, false);
  });
});

describe('subscriptions & offline payments', () => {
  let newToken;
  let subId;
  let paidWeek; // first week covered by the confirmed payment

  const register = async (name, email) =>
    (
      await call('POST', '/api/auth/register', {
        body: { name, email, password: 'password123', address: { street: '1 Test St', suburb: 'Parramatta', state: 'NSW', postcode: '2150' } },
      })
    ).body.accessToken;

  const confirmPayment = (body) =>
    call('POST', `/api/admin/subscriptions/${subId}/confirm-payment`, { token: adminToken, body });

  before(async () => {
    newToken = await register('Priya', 'priya@example.com');
  });

  test('a new subscription waits for the manager to confirm payment', async () => {
    const plans = (await call('GET', '/api/customer/plans')).body.data;
    const lunchOnly = plans.find((p) => p.mealsPerDay === 1);
    const sub = await call('POST', '/api/customer/subscribe', {
      token: newToken,
      body: { planId: lunchOnly._id, defaultDeliverySlotId: slots[1]._id },
    });
    assert.equal(sub.status, 201);
    assert.equal(sub.body.subscription.status, 'pending');
    subId = sub.body.subscription._id;

    // Can't pick meals or request a second plan while unpaid
    const pick = await call('POST', '/api/customer/selection/week', {
      token: newToken,
      body: { weekStartDate: isoDay(futureMonday), selections: selection({ Monday: { lunch: dishes.lunch[0]._id } }) },
    });
    assert.equal(pick.status, 404);
    const again = await call('POST', '/api/customer/subscribe', { token: newToken, body: { planId: plans[0]._id } });
    assert.equal(again.status, 400);

    const dashboard = await call('GET', '/api/admin/dashboard', { token: adminToken });
    assert.equal(dashboard.body.stats.awaitingPayment, 1);
  });

  test('customers cannot confirm their own payment', async () => {
    const res = await call('POST', `/api/admin/subscriptions/${subId}/confirm-payment`, {
      token: newToken,
      body: { method: 'cash' },
    });
    assert.equal(res.status, 403);
  });

  test('the status switch cannot activate an unpaid request', async () => {
    const res = await call('PUT', `/api/admin/subscriptions/${subId}/status`, {
      token: adminToken,
      body: { status: 'active' },
    });
    assert.equal(res.status, 400);
  });

  test('rejects an unknown payment method', async () => {
    const res = await confirmPayment({ method: 'bitcoin' });
    assert.equal(res.status, 400);
  });

  test('confirming payment activates the plan from the first open week', async () => {
    const res = await confirmPayment({ method: 'cash' });
    assert.equal(res.status, 200, res.body.message);
    const sub = res.body.data;
    assert.equal(sub.status, 'active');
    assert.equal(sub.payments.length, 1);
    assert.equal(sub.payments[0].amountAUD, sub.plan.priceAUD);

    paidWeek = getFirstOpenWeekMonday();
    assert.equal(new Date(sub.startDate).getTime(), paidWeek.getTime());
    const expectedEnd = new Date(paidWeek);
    expectedEnd.setDate(expectedEnd.getDate() + 6);
    expectedEnd.setHours(23, 59, 59, 999);
    assert.equal(new Date(sub.endDate).getTime(), expectedEnd.getTime());
  });

  test('meals after the paid period are rejected until the next payment', async () => {
    const nextWeek = new Date(paidWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    await publishMenu(nextWeek);

    const blocked = await call('POST', '/api/customer/selection/week', {
      token: newToken,
      body: { weekStartDate: isoDay(nextWeek), selections: selection({ Monday: { lunch: dishes.lunch[0]._id } }, nextWeek) },
    });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.code, 'PAYMENT_REQUIRED');

    // Renewal continues straight on from the last paid day
    const renewal = await confirmPayment({ method: 'bank_transfer', reference: 'CBA 1234', amountAUD: 65 });
    assert.equal(renewal.status, 200);
    const [first, second] = renewal.body.data.payments;
    const dayAfterFirst = new Date(first.periodEnd);
    dayAfterFirst.setDate(dayAfterFirst.getDate() + 1);
    dayAfterFirst.setHours(0, 0, 0, 0);
    assert.equal(new Date(second.periodStart).getTime(), dayAfterFirst.getTime());
    assert.equal(second.reference, 'CBA 1234');

    const allowed = await call('POST', '/api/customer/selection/week', {
      token: newToken,
      body: { weekStartDate: isoDay(nextWeek), selections: selection({ Monday: { lunch: dishes.lunch[0]._id } }, nextWeek) },
    });
    assert.equal(allowed.status, 200, allowed.body.message);
  });

  test('enforces the plan\'s meals-per-day limit', async () => {
    await publishMenu(paidWeek); // re-publishing is an upsert; ensures the week has a menu
    const res = await call('POST', '/api/customer/selection/week', {
      token: newToken,
      body: {
        weekStartDate: isoDay(paidWeek),
        selections: selection({ Monday: { breakfast: dishes.breakfast[0]._id, lunch: dishes.lunch[0]._id } }, paidWeek),
      },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PLAN_LIMIT');
  });

  test('pausing cancels future pending orders, and blocks re-subscribing', async () => {
    const pause = await call('POST', '/api/customer/subscription/pause', { token: newToken });
    assert.equal(pause.status, 200);
    assert.ok(pause.body.cancelledOrders >= 1);

    const plans = (await call('GET', '/api/customer/plans')).body.data;
    const again = await call('POST', '/api/customer/subscribe', { token: newToken, body: { planId: plans[0]._id } });
    assert.equal(again.status, 400);
  });

  test('a paused subscription can be resumed', async () => {
    const res = await call('POST', '/api/customer/subscription/resume', { token: newToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'active');
  });

  test('cancelling works and frees the customer to subscribe again', async () => {
    const cancel = await call('POST', '/api/customer/subscription/cancel', { token: newToken });
    assert.equal(cancel.status, 200);
    const mine = await call('GET', '/api/customer/subscription', { token: newToken });
    assert.equal(mine.body.data, null);
  });

  test('a customer can withdraw an unpaid request', async () => {
    const token = await register('Ravi', 'ravi@example.com');
    const plans = (await call('GET', '/api/customer/plans')).body.data;
    await call('POST', '/api/customer/subscribe', { token, body: { planId: plans[0]._id } });
    const cancel = await call('POST', '/api/customer/subscription/cancel', { token });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.status, 'cancelled');
  });
});

describe('admin', () => {
  test('food item updates ignore non-editable fields', async () => {
    const item = dishes.snack?.[0] || dishes.lunch[2] || dishes.lunch[0];
    const attacker = new mongoose.Types.ObjectId();
    const res = await call('PUT', `/api/admin/food-items/${item._id}`, {
      token: adminToken,
      body: { price: 21, createdBy: attacker },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.price, 21);
    assert.equal(res.body.data.createdBy, String(item.createdBy));
  });

  test('rejects an invalid order status', async () => {
    const order = await Order.findOne();
    const res = await call('PUT', `/api/admin/orders/${order._id}/status`, {
      token: adminToken,
      body: { status: 'eaten' },
    });
    assert.equal(res.status, 400);
  });

  test('orders list is sorted by delivery window', async () => {
    const res = await call('GET', `/api/admin/orders?date=${isoDay(futureMonday)}`, { token: adminToken });
    assert.equal(res.status, 200);
    const times = res.body.data.map((o) => o.deliverySlot.startTime);
    assert.deepEqual(times, [...times].sort());
  });
});
