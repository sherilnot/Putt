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
let customerToken; // seeded demo customer on a 3-meals-a-day plan
let dishes;
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

  const plan = (await call('GET', '/api/customer/week')).body.data;
  dishes = plan.dishes;
  slots = plan.pickupSlots;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

// Seven days for `monday`'s week with no meals, picked up in the midday window unless overridden
const week = (overrides = {}, monday = futureMonday) =>
  getDaysForWeek(monday).map((d) => ({
    dayName: d.dayName,
    meals: [],
    pickupSlot: slots[1]._id,
    ...(overrides[d.dayName] || {}),
  }));

const saveWeek = (token, days, monday = futureMonday) =>
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

describe('weekly meal planning (pickup)', () => {
  test('anyone can see the dishes and pickup windows', async () => {
    const res = await call('GET', '/api/customer/week');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.dishes.length, 15);
    assert.equal(res.body.data.pickupSlots.length, 3);
    assert.equal(res.body.data.mealsPerDay, null);
  });

  test('signed-in customers see their plan\'s meals per day', async () => {
    const res = await call('GET', '/api/customer/week', { token: customerToken });
    assert.equal(res.body.data.mealsPerDay, 3);
  });

  test('saves meals with one pickup time per day and creates matching orders', async () => {
    const [a, b] = dishes;
    const res = await saveWeek(
      customerToken,
      week({
        Monday: { meals: [a._id, a._id, b._id] }, // the same dish twice is fine
        Tuesday: { meals: [b._id], pickupSlot: slots[2]._id },
      })
    );
    assert.equal(res.status, 200, res.body.message);

    const orders = await Order.find({ status: 'pending', date: { $gte: futureMonday } }).sort({ date: 1, mealNumber: 1 });
    assert.deepEqual(orders.map((o) => o.mealNumber), [1, 2, 3, 1]);
    assert.equal(String(orders[0].pickupSlot), String(slots[1]._id));
    assert.equal(String(orders[3].pickupSlot), String(slots[2]._id));

    const reload = await call('GET', `/api/customer/week?weekStartDate=${isoDay(futureMonday)}`, { token: customerToken });
    const monday = reload.body.data.selection.days.find((d) => d.dayName === 'Monday');
    assert.equal(monday.meals.length, 3);
  });

  test('fewer meals removes the extra orders; a new pickup time moves the rest', async () => {
    const res = await saveWeek(customerToken, week({ Monday: { meals: [dishes[0]._id], pickupSlot: slots[0]._id } }));
    assert.equal(res.status, 200);
    const orders = await Order.find({ status: 'pending', date: { $gte: futureMonday } });
    assert.equal(orders.length, 1);
    assert.equal(String(orders[0].pickupSlot), String(slots[0]._id));
  });

  test('more meals than the plan allows is rejected', async () => {
    const id = dishes[0]._id;
    const res = await saveWeek(customerToken, week({ Monday: { meals: [id, id, id, id] } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PLAN_LIMIT');
  });

  test('a pickup time is required for days with meals', async () => {
    const res = await saveWeek(customerToken, week({ Monday: { meals: [dishes[0]._id], pickupSlot: null } }));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'PICKUP_REQUIRED');
  });

  test('rejects an unavailable dish', async () => {
    await FoodItem.updateOne({ _id: dishes[0]._id }, { isAvailable: false });
    const res = await saveWeek(customerToken, week({ Monday: { meals: [dishes[0]._id] } }));
    await FoodItem.updateOne({ _id: dishes[0]._id }, { isAvailable: true });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /no longer available/);
  });

  test('rejects changes to a week whose Thursday cutoff has passed', async () => {
    const res = await saveWeek(customerToken, [], weekPlus(0));
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SELECTION_LOCKED');
  });
});

describe('subscriptions & offline payments', () => {
  let newToken;
  let subId;
  let paidWeek; // first week covered by the confirmed payment

  const register = async (name, email) =>
    (
      await call('POST', '/api/auth/register', {
        body: { name, email, password: 'password123', phone: '0400 000 000' },
      })
    ).body.accessToken;

  const confirmPayment = (body) =>
    call('POST', `/api/admin/subscriptions/${subId}/confirm-payment`, { token: adminToken, body });

  before(async () => {
    newToken = await register('Priya', 'priya@example.com');
  });

  test('a new subscription waits for the manager to confirm payment', async () => {
    const plans = (await call('GET', '/api/customer/plans')).body.data;
    const oneMeal = plans.find((p) => p.mealsPerDay === 1);
    const sub = await call('POST', '/api/customer/subscribe', { token: newToken, body: { planId: oneMeal._id } });
    assert.equal(sub.status, 201);
    assert.equal(sub.body.subscription.status, 'pending');
    subId = sub.body.subscription._id;

    // Can't choose meals or request a second plan while unpaid
    const pick = await saveWeek(newToken, week({ Monday: { meals: [dishes[0]._id] } }));
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
    const days = week({ Monday: { meals: [dishes[0]._id] } }, nextWeek);

    const blocked = await saveWeek(newToken, days, nextWeek);
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

    const allowed = await saveWeek(newToken, days, nextWeek);
    assert.equal(allowed.status, 200, allowed.body.message);
  });

  test('a 1-meal plan cannot take 2 meals a day', async () => {
    const days = week({ Monday: { meals: [dishes[0]._id, dishes[1]._id] } }, paidWeek);
    const res = await saveWeek(newToken, days, paidWeek);
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
    const item = await FoodItem.findOne().lean();
    const attacker = new mongoose.Types.ObjectId();
    const res = await call('PUT', `/api/admin/food-items/${item._id}`, {
      token: adminToken,
      body: { name: 'Chicken Biriyani (Large)', createdBy: attacker },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Chicken Biriyani (Large)');
    assert.equal(res.body.data.createdBy, String(item.createdBy));
  });

  test('dishes can be added without a meal category or price', async () => {
    const res = await call('POST', '/api/admin/food-items', {
      token: adminToken,
      body: { name: 'Porotta and Beef Fry', dietType: 'non-veg' },
    });
    assert.equal(res.status, 201, res.body.message);
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
    const res = await call('GET', `/api/admin/orders?date=${isoDay(futureMonday)}`, { token: adminToken });
    assert.equal(res.status, 200);
    const times = res.body.data.map((o) => o.pickupSlot.startTime);
    assert.deepEqual(times, [...times].sort());
  });

  test('plans must have 1, 2 or 3 meals a day', async () => {
    const bad = await call('POST', '/api/admin/plans', {
      token: adminToken,
      body: { name: 'Four', priceAUD: 10, intervalDays: 7, mealsPerDay: 4 },
    });
    assert.equal(bad.status, 400);

    const plan = (await call('GET', '/api/admin/plans', { token: adminToken })).body.data[0];
    const res = await call('PUT', `/api/admin/plans/${plan._id}`, { token: adminToken, body: { mealsPerDay: 5 } });
    assert.equal(res.status, 400);
  });

  test('manager can add a pickup window', async () => {
    const res = await call('POST', '/api/admin/pickup-slots', {
      token: adminToken,
      body: { label: 'Late (8:00 – 9:00 PM)', startTime: '20:00', endTime: '21:00' },
    });
    assert.equal(res.status, 201, res.body.message);
  });
});
