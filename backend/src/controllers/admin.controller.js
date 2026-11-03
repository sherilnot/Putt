const FoodItem = require('../models/FoodItem');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const PickupSlot = require('../models/PickupSlot');
const { notifyOrderStatusChange } = require('../services/notification.service');
const { cancelFuturePendingOrders } = require('../services/order.service');
const { getFirstOpenWeekMonday } = require('../utils/weekUtils');

// Only copy whitelisted fields from a request body (prevents overwriting createdBy, messId, etc.)
const pick = (body, fields) =>
  fields.reduce((acc, f) => (body[f] !== undefined ? { ...acc, [f]: body[f] } : acc), {});

const FOOD_FIELDS = ['name', 'description', 'imageUrl', 'dietType', 'price', 'isAvailable'];
const PLAN_FIELDS = ['name', 'description', 'priceAUD', 'intervalDays', 'mealsPerDay', 'dietTypes', 'isActive'];
const SLOT_FIELDS = ['label', 'startTime', 'endTime', 'maxOrders', 'isActive'];
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'collected', 'cancelled'];
const SUBSCRIPTION_STATUSES = ['pending', 'active', 'paused', 'cancelled', 'expired'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'payid', 'other'];

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
const getDashboardStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [activeSubscribers, todaysOrders, pendingOrders, totalFoodItems, awaitingPayment] =
    await Promise.all([
      Subscription.countDocuments({ status: 'active' }),
      Order.countDocuments({
        date: { $gte: today, $lt: tomorrow },
      }),
      Order.countDocuments({
        date: { $gte: today, $lt: tomorrow },
        status: 'pending',
      }),
      FoodItem.countDocuments(),
      Subscription.countDocuments({ status: 'pending' }),
    ]);

  res.status(200).json({
    success: true,
    stats: {
      activeSubscribers,
      todaysOrders,
      pendingOrders,
      totalFoodItems,
      awaitingPayment,
    },
  });
};

// -------------------------------------------------------------
// FOOD ITEMS
// -------------------------------------------------------------
const getFoodItems = async (req, res) => {
  const { dietType, isAvailable } = req.query;
  const filter = {};

  if (dietType) filter.dietType = dietType;
  if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

  const foodItems = await FoodItem.find(filter).sort({ name: 1 });
  res.status(200).json({ success: true, count: foodItems.length, data: foodItems });
};

const createFoodItem = async (req, res) => {
  const { name, description, imageUrl, dietType, price, isAvailable } = req.body;

  const foodItem = await FoodItem.create({
    name,
    description,
    imageUrl,
    dietType,
    price,
    isAvailable: isAvailable !== undefined ? isAvailable : true,
    createdBy: req.user._id,
    messId: req.user.messId,
  });

  res.status(201).json({ success: true, data: foodItem });
};

const updateFoodItem = async (req, res) => {
  const foodItem = await FoodItem.findByIdAndUpdate(req.params.id, pick(req.body, FOOD_FIELDS), {
    new: true,
    runValidators: true,
  });

  if (!foodItem) {
    return res.status(404).json({ success: false, message: 'Food item not found' });
  }

  res.status(200).json({ success: true, data: foodItem });
};

const deleteFoodItem = async (req, res) => {
  const foodItem = await FoodItem.findByIdAndDelete(req.params.id);
  if (!foodItem) {
    return res.status(404).json({ success: false, message: 'Food item not found' });
  }
  res.status(200).json({ success: true, message: 'Food item deleted successfully' });
};

// -------------------------------------------------------------
// SUBSCRIPTION PLANS
// -------------------------------------------------------------
const getPlans = async (req, res) => {
  const plans = await SubscriptionPlan.find().sort({ priceAUD: 1 });
  res.status(200).json({ success: true, data: plans });
};

const createPlan = async (req, res) => {
  const { name, description, priceAUD, intervalDays, mealsPerDay, dietTypes } =
    req.body;

  const plan = await SubscriptionPlan.create({
    name,
    description,
    priceAUD,
    intervalDays,
    mealsPerDay,
    dietTypes,
    messId: req.user.messId,
  });

  res.status(201).json({ success: true, data: plan });
};

const updatePlan = async (req, res) => {
  // Load-and-save so schema validators (e.g. mealsPerDay 1–3) run
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Plan not found' });
  }
  plan.set(pick(req.body, PLAN_FIELDS));
  await plan.save();

  res.status(200).json({ success: true, data: plan });
};

const deletePlan = async (req, res) => {
  const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Plan not found' });
  }
  res.status(200).json({ success: true, message: 'Plan removed' });
};

// -------------------------------------------------------------
// SUBSCRIBERS
// -------------------------------------------------------------
const getAllSubscriptions = async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const subscriptions = await Subscription.find(filter)
    .populate('customer', 'name email phone address')
    .populate('plan')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
};

const updateSubscriptionStatus = async (req, res) => {
  const { status } = req.body;
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid subscription status' });
  }

  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    return res.status(404).json({ success: false, message: 'Subscription not found' });
  }

  // Activation only happens through a confirmed payment
  if (status === 'active' && subscription.payments.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Confirm the payment to activate this subscription.',
    });
  }

  subscription.status = status;
  await subscription.save();
  await subscription.populate([
    { path: 'customer', select: 'name email phone address' },
    { path: 'plan' },
  ]);

  if (['paused', 'cancelled', 'expired'].includes(status)) {
    await cancelFuturePendingOrders(subscription._id);
  }

  res.status(200).json({ success: true, data: subscription });
};

// @desc    Record an offline payment: activates a pending request, or extends a plan's paid period
// @route   POST /api/admin/subscriptions/:id/confirm-payment
// @access  Private (Admin)
const confirmSubscriptionPayment = async (req, res) => {
  const { method, reference, amountAUD } = req.body;

  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({
      success: false,
      message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`,
    });
  }

  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) {
    return res.status(404).json({ success: false, message: 'Subscription not found' });
  }
  if (subscription.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'This subscription was cancelled.' });
  }

  // A new period follows straight on from the last paid one; otherwise it starts with the
  // first week the customer can still choose meals for.
  const now = new Date();
  let periodStart;
  if (subscription.payments.length > 0 && subscription.endDate > now) {
    periodStart = new Date(subscription.endDate);
    periodStart.setDate(periodStart.getDate() + 1);
    periodStart.setHours(0, 0, 0, 0);
  } else {
    periodStart = getFirstOpenWeekMonday(now);
  }
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + subscription.plan.intervalDays - 1);
  periodEnd.setHours(23, 59, 59, 999);

  if (subscription.payments.length === 0 || subscription.endDate <= now) {
    subscription.startDate = periodStart;
  }
  subscription.endDate = periodEnd;
  if (['pending', 'expired'].includes(subscription.status)) subscription.status = 'active';

  subscription.payments.push({
    amountAUD: amountAUD !== undefined ? Number(amountAUD) : subscription.plan.priceAUD,
    method,
    reference: reference || '',
    periodStart,
    periodEnd,
    confirmedBy: req.user._id,
  });
  await subscription.save();
  await subscription.populate({ path: 'customer', select: 'name email phone address' });

  res.status(200).json({
    success: true,
    message: `Payment recorded. Paid until ${periodEnd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}.`,
    data: subscription,
  });
};

// -------------------------------------------------------------
// ORDERS
// -------------------------------------------------------------
const getOrders = async (req, res) => {
  const { date, pickupSlotId, status } = req.query;
  const filter = {};

  if (date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.date = { $gte: targetDate, $lt: nextDay };
  } else {
    // Default to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    filter.date = { $gte: today, $lt: tomorrow };
  }

  if (pickupSlotId) filter.pickupSlot = pickupSlotId;
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .populate('customer', 'name email phone')
    .populate('foodItem')
    .populate('pickupSlot')
    .sort({ mealNumber: 1 });

  // Group by pickup window (start times are "HH:mm", so they sort as strings), then by customer
  orders.sort(
    (a, b) =>
      (a.pickupSlot?.startTime || '99:99').localeCompare(b.pickupSlot?.startTime || '99:99') ||
      (a.customer?.name || '').localeCompare(b.customer?.name || '')
  );

  res.status(200).json({ success: true, count: orders.length, data: orders });
};

const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid order status' });
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  )
    .populate('customer')
    .populate('foodItem');

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Send push notification if configured
  if (order.customer && order.foodItem) {
    notifyOrderStatusChange(order.customer, status, order.foodItem.name).catch(
      (err) => console.error('Push notification failed:', err)
    );
  }

  res.status(200).json({ success: true, data: order });
};

// -------------------------------------------------------------
// PICKUP WINDOWS
// -------------------------------------------------------------
const getPickupSlots = async (req, res) => {
  const slots = await PickupSlot.find().sort({ startTime: 1 });
  res.status(200).json({ success: true, data: slots });
};

const createPickupSlot = async (req, res) => {
  const slot = await PickupSlot.create({
    ...pick(req.body, SLOT_FIELDS),
    messId: req.user.messId,
  });
  res.status(201).json({ success: true, data: slot });
};

const updatePickupSlot = async (req, res) => {
  const slot = await PickupSlot.findByIdAndUpdate(req.params.id, pick(req.body, SLOT_FIELDS), {
    new: true,
    runValidators: true,
  });

  if (!slot) {
    return res.status(404).json({ success: false, message: 'Pickup window not found' });
  }

  res.status(200).json({ success: true, data: slot });
};

const deletePickupSlot = async (req, res) => {
  const slot = await PickupSlot.findByIdAndDelete(req.params.id);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Pickup window not found' });
  }
  res.status(200).json({ success: true, message: 'Pickup window removed' });
};

module.exports = {
  getDashboardStats,
  getFoodItems,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAllSubscriptions,
  updateSubscriptionStatus,
  confirmSubscriptionPayment,
  getOrders,
  updateOrderStatus,
  getPickupSlots,
  createPickupSlot,
  updatePickupSlot,
  deletePickupSlot,
};
