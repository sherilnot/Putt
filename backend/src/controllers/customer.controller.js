const mongoose = require('mongoose');
const WeeklyMenu = require('../models/WeeklyMenu');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const FoodItem = require('../models/FoodItem');
const DeliverySlot = require('../models/DeliverySlot');
const CustomerWeeklySelection = require('../models/CustomerWeeklySelection');
const {
  isStripeConfigured,
  createSubscriptionSession,
  cancelStripeSubscription,
} = require('../services/stripe.service');
const { cancelFuturePendingOrders } = require('../services/order.service');
const { frontendUrl, isProduction } = require('../config/env');
const {
  getWeekMonday,
  getNextWeekMonday,
  getWeekSunday,
  getSelectionDeadline,
  isSelectionLocked,
  getDaysForWeek,
  formatDeadline,
} = require('../utils/weekUtils');

const MEAL_TIMES = ['breakfast', 'lunch', 'dinner'];

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

const getPublishedMenu = (monday) =>
  WeeklyMenu.findOne({ weekStartDate: monday, isPublished: true });

/**
 * Throws unless `foodItemId` is offered on the published menu for that day & meal time
 * and is currently available.
 */
const assertDishOnMenu = (menu, dayName, mealTime, foodItemId, availableIds) => {
  if (!mongoose.isValidObjectId(foodItemId)) {
    throw new ValidationError(`Invalid dish id for ${dayName} ${mealTime}.`);
  }
  const day = menu.days.find((d) => d.dayName === dayName);
  const slot = day && day.meals.find((m) => m.mealTime === mealTime);
  const offered = slot && slot.foodItems.some((id) => id.toString() === String(foodItemId));
  if (!offered) {
    throw new ValidationError(`That dish is not on the ${dayName} ${mealTime} menu.`);
  }
  if (!availableIds.has(String(foodItemId))) {
    throw new ValidationError(`That dish is currently unavailable for ${dayName} ${mealTime}.`);
  }
};

const loadAvailableIds = async (ids) => {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const items = await FoodItem.find({ _id: { $in: valid }, isAvailable: true }).select('_id');
  return new Set(items.map((i) => i._id.toString()));
};

const assertActiveSlot = async (slotId) => {
  if (!slotId || !mongoose.isValidObjectId(slotId)) {
    throw new ValidationError('Please choose a delivery slot.');
  }
  const slot = await DeliverySlot.findOne({ _id: slotId, isActive: true });
  if (!slot) throw new ValidationError('Selected delivery slot is not available.');
};

/**
 * Create/update the pending order for a customer's day & meal time, or remove it
 * when the meal is cleared (foodItemId = null).
 */
const syncOrder = async ({ user, subscription, date, mealTime, foodItemId, slotId }) => {
  const existing = await Order.findOne({
    customer: user._id,
    date: dayRange(date),
    mealTime,
    status: { $ne: 'cancelled' },
  });

  if (!foodItemId) {
    if (existing && existing.status === 'pending') await existing.deleteOne();
    return null;
  }

  if (existing) {
    if (existing.status !== 'pending') return existing; // already in the kitchen
    existing.foodItem = foodItemId;
    existing.deliverySlot = slotId;
    await existing.save();
    return existing;
  }

  const mealDate = new Date(date);
  mealDate.setHours(12, 0, 0, 0);
  return Order.create({
    customer: user._id,
    subscription: subscription._id,
    date: mealDate,
    mealTime,
    foodItem: foodItemId,
    deliverySlot: slotId,
    deliveryAddress: user.address,
    status: 'pending',
    messId: user.messId,
  });
};

const lockedResponse = (res, monday) =>
  res.status(400).json({
    success: false,
    code: 'SELECTION_LOCKED',
    message: `Cutoff passed: Meal selection for the week of ${monday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} closed on Thursday at 11:59 PM. Your selections are locked.`,
    deadline: formatDeadline(getSelectionDeadline(monday)),
  });

// @desc    Get the published menu for the current week (or the week containing `date`)
// @route   GET /api/customer/menu/week
// @access  Public
const getWeeklyMenu = async (req, res) => {
  const { date } = req.query;
  const monday = getWeekMonday(date ? new Date(date) : new Date());

  const menu = await WeeklyMenu.findOne({ weekStartDate: monday, isPublished: true }).populate(
    'days.meals.foodItems'
  );

  res.status(200).json({ success: true, data: menu });
};

// @desc    Get upcoming week menu for advance meal selection with Thursday cutoff status
// @route   GET /api/customer/menu/upcoming
// @access  Public (customer selection included when authenticated)
const getUpcomingWeekMenu = async (req, res) => {
  const now = new Date();
  const { weekStartDate } = req.query;

  // By default, customer selects for the NEXT week (starting next Monday)
  const targetMonday = weekStartDate
    ? getWeekMonday(new Date(weekStartDate))
    : getNextWeekMonday(now);

  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);
  const isLocked = isSelectionLocked(targetMonday, now);

  const menu = await getPublishedMenu(targetMonday).populate('days.meals.foodItems');

  let customerSelection = null;
  if (req.user) {
    customerSelection = await CustomerWeeklySelection.findOne({
      customer: req.user._id,
      weekStartDate: targetMonday,
    })
      .populate('selections.breakfast')
      .populate('selections.lunch')
      .populate('selections.dinner')
      .populate('selections.deliverySlot');
  }

  res.status(200).json({
    success: true,
    data: {
      menu,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      selectionDeadline: deadline,
      selectionDeadlineFormatted: formatDeadline(deadline),
      isLocked,
      isPublished: Boolean(menu),
      customerSelection,
    },
  });
};

// @desc    Submit or update 7-day meal selections (Breakfast, Lunch, Dinner) for the upcoming week
// @route   POST /api/customer/selection/week
// @access  Private (Customer)
const saveCustomerWeeklySelection = async (req, res) => {
  const { weekStartDate, selections, defaultDeliverySlotId } = req.body;

  if (!weekStartDate || !selections || !Array.isArray(selections)) {
    return res.status(400).json({
      success: false,
      message: 'weekStartDate and selections array are required.',
    });
  }

  const now = new Date();
  const targetMonday = getWeekMonday(new Date(weekStartDate));
  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);

  // 1. Enforce Thursday Cutoff
  if (isSelectionLocked(targetMonday, now)) return lockedResponse(res, targetMonday);

  // 2. Validate active subscription
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: 'active',
  }).populate('plan');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Active subscription required to select meals.',
    });
  }

  // 3. Menu must be published for exactly this week
  const weeklyMenu = await getPublishedMenu(targetMonday);
  if (!weeklyMenu) {
    return res.status(404).json({
      success: false,
      message: 'The menu for this week has not been published yet.',
    });
  }

  // 4. Validate every choice against the menu, availability and the plan's meals/day
  const weekDays = getDaysForWeek(targetMonday);
  const mealsPerDay = subscription.plan?.mealsPerDay || 3;
  const fallbackSlot = defaultDeliverySlotId || subscription.defaultDeliverySlot;
  const availableIds = await loadAvailableIds(
    selections.flatMap((s) => MEAL_TIMES.map((m) => s[m]).filter(Boolean))
  );

  const normalized = [];
  for (const choice of selections) {
    const weekDay = weekDays.find((d) => d.dayName === choice.dayName);
    if (!weekDay) throw new ValidationError(`Unknown day "${choice.dayName}".`);

    const picked = MEAL_TIMES.filter((m) => choice[m]);
    if (picked.length > mealsPerDay) {
      throw new ValidationError(
        `Your plan includes ${mealsPerDay} meal(s) per day; ${choice.dayName} has ${picked.length}.`,
        'PLAN_LIMIT'
      );
    }
    picked.forEach((m) => assertDishOnMenu(weeklyMenu, choice.dayName, m, choice[m], availableIds));

    const slotId = choice.deliverySlot || fallbackSlot || null;
    if (picked.length > 0) await assertActiveSlot(slotId);

    normalized.push({
      dayName: choice.dayName,
      date: weekDay.date, // trust server-computed dates, not the client's
      breakfast: choice.breakfast || null,
      lunch: choice.lunch || null,
      dinner: choice.dinner || null,
      deliverySlot: slotId,
    });
  }

  // 5. Upsert CustomerWeeklySelection
  const weeklySelection = await CustomerWeeklySelection.findOneAndUpdate(
    { customer: req.user._id, weekStartDate: targetMonday },
    {
      customer: req.user._id,
      subscription: subscription._id,
      weeklyMenu: weeklyMenu._id,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      selections: normalized,
      isLocked: false,
      submittedAt: now,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // 6. Sync kitchen orders and the subscription's selected meals for this week
  for (const day of normalized) {
    for (const mealTime of MEAL_TIMES) {
      await syncOrder({
        user: req.user,
        subscription,
        date: day.date,
        mealTime,
        foodItemId: day[mealTime],
        slotId: day.deliverySlot,
      });
    }
  }

  subscription.selectedMeals = subscription.selectedMeals
    .filter((m) => m.date < targetMonday || m.date > targetSunday)
    .concat(
      normalized.flatMap((day) =>
        MEAL_TIMES.filter((m) => day[m]).map((m) => ({
          date: day.date,
          mealTime: m,
          foodItem: day[m],
          deliverySlot: day.deliverySlot,
          locked: false,
        }))
      )
    );
  await subscription.save();

  const populated = await CustomerWeeklySelection.findById(weeklySelection._id)
    .populate('selections.breakfast')
    .populate('selections.lunch')
    .populate('selections.dinner')
    .populate('selections.deliverySlot');

  res.status(200).json({
    success: true,
    message: 'Your weekly meal choices have been saved successfully!',
    data: populated,
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

// @desc    Get available delivery slots
// @route   GET /api/customer/delivery-slots
// @access  Public
const getDeliverySlots = async (req, res) => {
  const slots = await DeliverySlot.find({ isActive: true }).sort({ startTime: 1 });
  res.status(200).json({ success: true, data: slots });
};

// @desc    Subscribe to a plan (activated by the Stripe webhook once paid)
// @route   POST /api/customer/subscribe
// @access  Private (Customer)
const subscribe = async (req, res) => {
  const { planId, defaultDeliverySlotId } = req.body;

  if (!mongoose.isValidObjectId(planId)) {
    return res.status(400).json({ success: false, message: 'A valid planId is required.' });
  }

  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
  }

  const existing = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['active', 'paused'] },
  });

  if (existing) {
    return res.status(400).json({
      success: false,
      message: `You already have a${existing.status === 'active' ? 'n active' : ' paused'} subscription.`,
      subscription: existing,
    });
  }

  // Mock (free) subscriptions are a local-dev convenience only
  if (!isStripeConfigured() && isProduction) {
    return res.status(503).json({
      success: false,
      message: 'Payments are not available right now. Please try again later.',
    });
  }

  // An abandoned checkout should not block a new attempt
  await Subscription.deleteMany({ customer: req.user._id, status: 'pending' });

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.intervalDays);

  const checkoutSession = await createSubscriptionSession(
    req.user,
    plan,
    `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    `${frontendUrl}/cancel`
  );

  // Without Stripe configured (local dev) there is no payment step, so activate directly.
  const requiresPayment = isStripeConfigured();

  const subscription = await Subscription.create({
    customer: req.user._id,
    plan: plan._id,
    startDate,
    endDate,
    status: requiresPayment ? 'pending' : 'active',
    stripeCheckoutSessionId: requiresPayment ? checkoutSession.id : '',
    stripeSubscriptionId: requiresPayment ? '' : checkoutSession.id,
    defaultDeliverySlot: defaultDeliverySlotId || null,
    messId: req.user.messId,
  });

  await subscription.populate('plan');

  res.status(201).json({
    success: true,
    message: requiresPayment
      ? 'Complete payment to activate your subscription.'
      : 'Subscription created successfully',
    subscription,
    checkoutUrl: requiresPayment ? checkoutSession.url : null,
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
    .populate('defaultDeliverySlot')
    .populate('selectedMeals.foodItem')
    .populate('selectedMeals.deliverySlot')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: subscription || null,
  });
};

// @desc    Select or update meal choice for a specific date and meal time
// @route   PUT /api/customer/subscription/meal
// @access  Private (Customer)
const selectMeal = async (req, res) => {
  const { date, mealTime, foodItemId, deliverySlotId } = req.body;

  if (!date || !mealTime || !foodItemId || !deliverySlotId) {
    return res.status(400).json({
      success: false,
      message: 'Please provide date, mealTime, foodItemId, and deliverySlotId.',
    });
  }
  if (!MEAL_TIMES.includes(mealTime)) {
    return res.status(400).json({ success: false, message: 'Invalid mealTime.' });
  }

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Same Thursday cutoff as the weekly selection, so single-meal edits can't bypass it
  const monday = getWeekMonday(targetDate);
  if (isSelectionLocked(monday)) return lockedResponse(res, monday);

  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: 'active',
  }).populate('plan');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Active subscription required to select meals.',
    });
  }

  const menu = await getPublishedMenu(monday);
  if (!menu) {
    return res.status(404).json({
      success: false,
      message: 'The menu for this week has not been published yet.',
    });
  }

  const dayName = getDaysForWeek(monday).find(
    (d) => d.date.toDateString() === targetDate.toDateString()
  ).dayName;
  assertDishOnMenu(menu, dayName, mealTime, foodItemId, await loadAvailableIds([foodItemId]));
  await assertActiveSlot(deliverySlotId);

  const otherMeals = await Order.countDocuments({
    customer: req.user._id,
    date: dayRange(targetDate),
    mealTime: { $ne: mealTime },
    status: { $ne: 'cancelled' },
  });
  const mealsPerDay = subscription.plan?.mealsPerDay || 3;
  if (otherMeals + 1 > mealsPerDay) {
    throw new ValidationError(`Your plan includes ${mealsPerDay} meal(s) per day.`, 'PLAN_LIMIT');
  }

  // Replace previous selection for that date and mealTime if any
  subscription.selectedMeals = subscription.selectedMeals.filter(
    (item) =>
      !(new Date(item.date).toDateString() === targetDate.toDateString() && item.mealTime === mealTime)
  );
  subscription.selectedMeals.push({
    date: targetDate,
    mealTime,
    foodItem: foodItemId,
    deliverySlot: deliverySlotId,
    locked: false,
  });
  await subscription.save();

  const order = await syncOrder({
    user: req.user,
    subscription,
    date: targetDate,
    mealTime,
    foodItemId,
    slotId: deliverySlotId,
  });

  const updatedSubscription = await Subscription.findById(subscription._id)
    .populate('plan')
    .populate('selectedMeals.foodItem')
    .populate('selectedMeals.deliverySlot');

  res.status(200).json({
    success: true,
    message: 'Meal selection updated successfully',
    data: updatedSubscription,
    order,
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

  if (subscription.stripeSubscriptionId) {
    await cancelStripeSubscription(subscription.stripeSubscriptionId);
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
    .populate('deliverySlot')
    .sort({ date: -1, createdAt: -1 });

  res.status(200).json({ success: true, count: orders.length, data: orders });
};

module.exports = {
  getWeeklyMenu,
  getUpcomingWeekMenu,
  saveCustomerWeeklySelection,
  getPlans,
  getDeliverySlots,
  subscribe,
  getMySubscription,
  selectMeal,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  getMyOrders,
};
