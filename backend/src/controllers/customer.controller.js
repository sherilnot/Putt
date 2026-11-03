const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const FoodItem = require('../models/FoodItem');
const PickupSlot = require('../models/PickupSlot');
const CustomerWeeklySelection = require('../models/CustomerWeeklySelection');
const { cancelFuturePendingOrders } = require('../services/order.service');
const {
  getWeekMonday,
  getNextWeekMonday,
  getWeekSunday,
  getSelectionDeadline,
  isSelectionLocked,
  getDaysForWeek,
  formatDeadline,
} = require('../utils/weekUtils');

class ValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.statusCode = 400;
    this.code = code;
  }
}

const dayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

const loadActivePlanSubscription = (customerId) =>
  Subscription.findOne({ customer: customerId, status: 'active' }).populate('plan');

/**
 * Make the customer's pending orders for one day match their chosen dishes:
 * meal N → order with mealNumber N, all collected in the same pickup window.
 */
const syncDayOrders = async ({ user, subscription, date, meals, pickupSlot }) => {
  const existing = await Order.find({
    customer: user._id,
    date: dayRange(date),
    status: { $ne: 'cancelled' },
  });

  const mealDate = new Date(date);
  mealDate.setHours(12, 0, 0, 0);

  for (let i = 0; i < 3; i += 1) {
    const mealNumber = i + 1;
    const foodItem = meals[i];
    const order = existing.find((o) => o.mealNumber === mealNumber);

    if (!foodItem) {
      if (order && order.status === 'pending') await order.deleteOne();
      continue;
    }
    if (order) {
      if (order.status !== 'pending') continue; // already in the kitchen
      order.foodItem = foodItem;
      order.pickupSlot = pickupSlot;
      await order.save();
    } else {
      await Order.create({
        customer: user._id,
        subscription: subscription._id,
        date: mealDate,
        mealNumber,
        foodItem,
        pickupSlot,
        status: 'pending',
        messId: user.messId,
      });
    }
  }
};

/**
 * Meals can only be chosen for days covered by a payment the manager has confirmed.
 */
const assertWithinPaidPeriod = (subscription, date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const start = new Date(subscription.startDate);
  start.setHours(0, 0, 0, 0);
  if (day < start || day > subscription.endDate) {
    const paidUntil = new Date(subscription.endDate).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    throw new ValidationError(
      day < start
        ? `Your plan starts on ${start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}.`
        : `Your plan is paid until ${paidUntil}. Pay the manager for your next period to choose meals after that.`,
      'PAYMENT_REQUIRED'
    );
  }
};

const lockedResponse = (res, monday) =>
  res.status(400).json({
    success: false,
    code: 'SELECTION_LOCKED',
    message: `Cutoff passed: Meal selection for the week of ${monday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} closed on Thursday at 11:59 PM. Your selections are locked.`,
    deadline: formatDeadline(getSelectionDeadline(monday)),
  });

// @desc    Everything needed to plan a week: dishes, pickup windows, cutoff, and the
//          customer's plan limit and saved choices when signed in
// @route   GET /api/customer/week?weekStartDate=YYYY-MM-DD (defaults to next week)
// @access  Public (customer details included when authenticated)
const getWeekPlan = async (req, res) => {
  const now = new Date();
  const { weekStartDate } = req.query;
  const targetMonday = weekStartDate
    ? getWeekMonday(new Date(weekStartDate))
    : getNextWeekMonday(now);
  const deadline = getSelectionDeadline(targetMonday);

  const [dishes, pickupSlots] = await Promise.all([
    FoodItem.find({ isAvailable: true }).sort({ name: 1 }),
    PickupSlot.find({ isActive: true }).sort({ startTime: 1 }),
  ]);

  let mealsPerDay = null;
  let selection = null;
  if (req.user) {
    const subscription = await loadActivePlanSubscription(req.user._id);
    mealsPerDay = subscription?.plan?.mealsPerDay || null;
    selection = await CustomerWeeklySelection.findOne({
      customer: req.user._id,
      weekStartDate: targetMonday,
    });
  }

  res.status(200).json({
    success: true,
    data: {
      weekStartDate: targetMonday,
      weekEndDate: getWeekSunday(targetMonday),
      selectionDeadline: deadline,
      selectionDeadlineFormatted: formatDeadline(deadline),
      isLocked: isSelectionLocked(targetMonday, now),
      dishes,
      pickupSlots,
      mealsPerDay,
      selection,
    },
  });
};

// @desc    Save a week of choices: for each day, up to the plan's meals and one pickup window
// @route   POST /api/customer/selection/week
// @body    { weekStartDate, days: [{ dayName, meals: [foodItemId], pickupSlot }] }
// @access  Private (Customer)
const saveWeekSelection = async (req, res) => {
  const { weekStartDate, days } = req.body;

  if (!weekStartDate || !Array.isArray(days)) {
    return res.status(400).json({
      success: false,
      message: 'weekStartDate and days array are required.',
    });
  }

  const now = new Date();
  const targetMonday = getWeekMonday(new Date(weekStartDate));
  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);

  // 1. Enforce Thursday cutoff
  if (isSelectionLocked(targetMonday, now)) return lockedResponse(res, targetMonday);

  // 2. Active (paid) subscription required
  const subscription = await loadActivePlanSubscription(req.user._id);
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Active subscription required to choose meals.',
    });
  }
  const mealsPerDay = subscription.plan?.mealsPerDay || 1;

  // 3. Validate each day: meal count, paid period, dishes available, pickup window chosen
  const allIds = days.flatMap((d) => d.meals || []);
  if (allIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new ValidationError('One of the chosen dishes is invalid.');
  }
  const available = new Set(
    (await FoodItem.find({ _id: { $in: allIds }, isAvailable: true }).select('_id')).map((f) =>
      f._id.toString()
    )
  );
  const activeSlots = new Set(
    (await PickupSlot.find({ isActive: true }).select('_id')).map((s) => s._id.toString())
  );

  const weekDays = getDaysForWeek(targetMonday);
  const normalized = [];
  for (const choice of days) {
    const weekDay = weekDays.find((d) => d.dayName === choice.dayName);
    if (!weekDay) throw new ValidationError(`Unknown day "${choice.dayName}".`);

    const meals = (choice.meals || []).filter(Boolean);
    if (meals.length > mealsPerDay) {
      throw new ValidationError(
        `Your plan includes ${mealsPerDay} meal${mealsPerDay > 1 ? 's' : ''} a day; ${choice.dayName} has ${meals.length}.`,
        'PLAN_LIMIT'
      );
    }
    if (meals.length > 0) {
      assertWithinPaidPeriod(subscription, weekDay.date);
      if (meals.some((id) => !available.has(String(id)))) {
        throw new ValidationError(`A dish chosen for ${choice.dayName} is no longer available.`);
      }
      if (!choice.pickupSlot || !activeSlots.has(String(choice.pickupSlot))) {
        throw new ValidationError(`Choose a pickup time for ${choice.dayName}.`, 'PICKUP_REQUIRED');
      }
    }

    normalized.push({
      dayName: choice.dayName,
      date: weekDay.date, // trust server-computed dates, not the client's
      meals,
      pickupSlot: meals.length > 0 ? choice.pickupSlot : null,
    });
  }

  // 4. Save the week's choices
  const selection = await CustomerWeeklySelection.findOneAndUpdate(
    { customer: req.user._id, weekStartDate: targetMonday },
    {
      customer: req.user._id,
      subscription: subscription._id,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      days: normalized,
      submittedAt: now,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // 5. Kitchen orders follow the choices
  for (const day of normalized) {
    await syncDayOrders({ user: req.user, subscription, ...day });
  }

  res.status(200).json({
    success: true,
    message: 'Your meals for the week are saved!',
    data: selection,
    selectionDeadlineFormatted: formatDeadline(deadline),
  });
};

// @desc    Get available subscription plans
// @route   GET /api/customer/plans
// @access  Public
const getPlans = async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceAUD: 1 });
  res.status(200).json({ success: true, count: plans.length, data: plans });
};

// @desc    Request a plan. It stays 'pending' until the manager confirms the offline payment.
// @route   POST /api/customer/subscribe
// @access  Private (Customer)
const subscribe = async (req, res) => {
  const { planId } = req.body;

  if (!mongoose.isValidObjectId(planId)) {
    return res.status(400).json({ success: false, message: 'A valid planId is required.' });
  }

  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
  }

  const existing = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['pending', 'active', 'paused'] },
  });

  if (existing) {
    const what = {
      pending: 'a plan request awaiting payment confirmation',
      active: 'an active subscription',
      paused: 'a paused subscription',
    }[existing.status];
    return res.status(400).json({
      success: false,
      message: `You already have ${what}.`,
      subscription: existing,
    });
  }

  // Dates are provisional; the paid period is set when the manager confirms payment.
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.intervalDays);

  const subscription = await Subscription.create({
    customer: req.user._id,
    plan: plan._id,
    startDate,
    endDate,
    status: 'pending',
    messId: req.user.messId,
  });

  await subscription.populate('plan');

  res.status(201).json({
    success: true,
    message: `Request sent! Pay $${plan.priceAUD} AUD to the mess manager. Your plan starts once they confirm your payment.`,
    subscription,
  });
};

// @desc    Get customer's current subscription
// @route   GET /api/customer/subscription
// @access  Private (Customer)
const getMySubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['active', 'paused', 'pending'] },
  })
    .populate('plan')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: subscription || null,
  });
};

// @desc    Pause subscription
// @route   POST /api/customer/subscription/pause
// @access  Private (Customer)
const pauseSubscription = async (req, res) => {
  const subscription = await Subscription.findOneAndUpdate(
    { customer: req.user._id, status: 'active' },
    { status: 'paused' },
    { new: true }
  ).populate('plan');

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No active subscription found.' });
  }

  const cancelledOrders = await cancelFuturePendingOrders(subscription._id);

  res.status(200).json({
    success: true,
    message: 'Subscription paused successfully',
    data: subscription,
    cancelledOrders,
  });
};

// @desc    Resume a paused subscription
// @route   POST /api/customer/subscription/resume
// @access  Private (Customer)
const resumeSubscription = async (req, res) => {
  const subscription = await Subscription.findOneAndUpdate(
    { customer: req.user._id, status: 'paused' },
    { status: 'active' },
    { new: true }
  ).populate('plan');

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No paused subscription found.' });
  }

  res.status(200).json({
    success: true,
    message: 'Subscription resumed. Pick your meals for the upcoming week!',
    data: subscription,
  });
};

// @desc    Cancel subscription
// @route   POST /api/customer/subscription/cancel
// @access  Private (Customer)
const cancelSubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['active', 'paused', 'pending'] },
  });

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No subscription found to cancel.' });
  }

  subscription.status = 'cancelled';
  await subscription.save();
  const cancelledOrders = await cancelFuturePendingOrders(subscription._id);

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully',
    data: subscription,
    cancelledOrders,
  });
};

// @desc    Get customer orders / history
// @route   GET /api/customer/orders
// @access  Private (Customer)
const getMyOrders = async (req, res) => {
  const { date } = req.query;
  const filter = { customer: req.user._id };

  if (date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.date = { $gte: targetDate, $lt: nextDay };
  }

  const orders = await Order.find(filter)
    .populate('foodItem')
    .populate('pickupSlot')
    .sort({ date: -1, mealNumber: 1 });

  res.status(200).json({ success: true, count: orders.length, data: orders });
};

module.exports = {
  getWeekPlan,
  saveWeekSelection,
  getPlans,
  subscribe,
  getMySubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  getMyOrders,
};
