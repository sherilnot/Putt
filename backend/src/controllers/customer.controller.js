const WeeklyMenu = require('../models/WeeklyMenu');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const DeliverySlot = require('../models/DeliverySlot');
const CustomerWeeklySelection = require('../models/CustomerWeeklySelection');
const { createSubscriptionSession, cancelStripeSubscription } = require('../services/stripe.service');
const {
  getWeekMonday,
  getNextWeekMonday,
  getWeekSunday,
  getSelectionDeadline,
  isSelectionLocked,
  formatDeadline,
  formatDayHeader,
} = require('../utils/weekUtils');

// @desc    Get active weekly menu (or for a specific weekStartDate)
// @route   GET /api/customer/menu/week
// @access  Public or Customer
const getWeeklyMenu = async (req, res) => {
  const { date } = req.query;
  let query = { isActive: true };

  if (date) {
    const targetDate = new Date(date);
    query = { weekStartDate: targetDate };
  }

  // Find most recent active weekly menu
  const menu = await WeeklyMenu.findOne(query)
    .populate('days.meals.foodItems')
    .sort({ weekStartDate: -1 });

  res.status(200).json({ success: true, data: menu });
};

// @desc    Get upcoming week menu for advance meal selection with Thursday cutoff status
// @route   GET /api/customer/menu/upcoming
// @access  Public or Customer
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

  // Find published menu for target week
  let menu = await WeeklyMenu.findOne({
    weekStartDate: targetMonday,
    isPublished: true,
  }).populate('days.meals.foodItems');

  // If none explicitly published for next week yet, fall back to any active menu for preview
  if (!menu) {
    menu = await WeeklyMenu.findOne({ isActive: true })
      .populate('days.meals.foodItems')
      .sort({ weekStartDate: -1 });
  }

  // If customer is logged in, fetch their existing weekly selection
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
      isPublished: menu ? menu.isPublished : false,
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

  // 1. Enforce Thursday Cutoff: Cannot modify if deadline has passed!
  if (isSelectionLocked(targetMonday, now)) {
    return res.status(400).json({
      success: false,
      code: 'SELECTION_LOCKED',
      message: `Cutoff passed: Meal selection for the week of ${targetMonday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} closed on Thursday at 11:59 PM. Your selections are locked.`,
      deadline: formatDeadline(deadline),
    });
  }

  // 2. Validate active subscription
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: 'active',
  });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Active subscription required to select meals.',
    });
  }

  // 3. Find weekly menu
  let weeklyMenu = await WeeklyMenu.findOne({
    weekStartDate: targetMonday,
    isPublished: true,
  });

  if (!weeklyMenu) {
    weeklyMenu = await WeeklyMenu.findOne({ isActive: true }).sort({ weekStartDate: -1 });
  }

  // 4. Upsert CustomerWeeklySelection
  let weeklySelection = await CustomerWeeklySelection.findOne({
    customer: req.user._id,
    weekStartDate: targetMonday,
  });

  if (weeklySelection) {
    weeklySelection.selections = selections;
    weeklySelection.isLocked = false;
    weeklySelection.submittedAt = now;
    weeklySelection.weeklyMenu = weeklyMenu ? weeklyMenu._id : weeklySelection.weeklyMenu;
    await weeklySelection.save();
  } else {
    weeklySelection = await CustomerWeeklySelection.create({
      customer: req.user._id,
      subscription: subscription._id,
      weeklyMenu: weeklyMenu ? weeklyMenu._id : null,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      selections,
      isLocked: false,
      submittedAt: now,
    });
  }

  // 5. Also sync to Subscription.selectedMeals and Orders for kitchen dispatch
  const defaultSlot = defaultDeliverySlotId || subscription.defaultDeliverySlot;

  for (const dayChoice of selections) {
    const mealDate = new Date(dayChoice.date);
    mealDate.setHours(12, 0, 0, 0);

    const mealTimesToProcess = [
      { mealTime: 'breakfast', foodItemId: dayChoice.breakfast },
      { mealTime: 'lunch', foodItemId: dayChoice.lunch },
      { mealTime: 'dinner', foodItemId: dayChoice.dinner },
    ];

    for (const m of mealTimesToProcess) {
      if (!m.foodItemId) continue;

      const slotId = dayChoice.deliverySlot || defaultSlot;

      // Upsert order
      const dayStart = new Date(mealDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(mealDate);
      dayEnd.setHours(23, 59, 59, 999);

      let order = await Order.findOne({
        customer: req.user._id,
        date: { $gte: dayStart, $lte: dayEnd },
        mealTime: m.mealTime,
      });

      if (order) {
        order.foodItem = m.foodItemId;
        if (slotId) order.deliverySlot = slotId;
        await order.save();
      } else {
        await Order.create({
          customer: req.user._id,
          subscription: subscription._id,
          date: mealDate,
          mealTime: m.mealTime,
          foodItem: m.foodItemId,
          deliverySlot: slotId,
          deliveryAddress: req.user.address,
          status: 'pending',
          messId: req.user.messId,
        });
      }
    }
  }

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

// @desc    Subscribe to a plan
// @route   POST /api/customer/subscribe
// @access  Private (Customer)
const subscribe = async (req, res) => {
  const { planId, defaultDeliverySlotId } = req.body;

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
  }

  // Check if user already has an active subscription
  const existingActive = await Subscription.findOne({
    customer: req.user._id,
    status: 'active',
  });

  if (existingActive) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active subscription.',
      subscription: existingActive,
    });
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.intervalDays);

  const checkoutSession = await createSubscriptionSession(
    req.user,
    plan,
    `${process.env.FRONTEND_URL || 'http://localhost:8081'}/success?session_id={CHECKOUT_SESSION_ID}`,
    `${process.env.FRONTEND_URL || 'http://localhost:8081'}/cancel`
  );

  const subscription = await Subscription.create({
    customer: req.user._id,
    plan: plan._id,
    startDate,
    endDate,
    status: 'active',
    stripeSubscriptionId: checkoutSession.id,
    defaultDeliverySlot: defaultDeliverySlotId || null,
    messId: req.user.messId,
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    subscription,
    checkoutUrl: checkoutSession.url,
  });
};

// @desc    Get customer's current subscription
// @route   GET /api/customer/subscription
// @access  Private (Customer)
const getMySubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['active', 'paused'] },
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

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // 24h cutoff check: Cannot change meal if less than 24h away
  const now = new Date();
  const cutoffTime = new Date(targetDate);
  cutoffTime.setDate(cutoffTime.getDate() - 1); // 24 hours before midnight of delivery day

  if (now > cutoffTime) {
    return res.status(400).json({
      success: false,
      message: 'Cutoff passed: Meals cannot be modified within 24 hours of delivery.',
    });
  }

  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: 'active',
  });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Active subscription required to select meals.',
    });
  }

  // Remove previous selection for that date and mealTime if any
  subscription.selectedMeals = subscription.selectedMeals.filter(
    (item) =>
      !(
        new Date(item.date).toISOString().slice(0, 10) ===
          targetDate.toISOString().slice(0, 10) && item.mealTime === mealTime
      )
  );

  // Add new selection
  subscription.selectedMeals.push({
    date: targetDate,
    mealTime,
    foodItem: foodItemId,
    deliverySlot: deliverySlotId,
    locked: false,
  });

  await subscription.save();

  // Also create or upsert today's/target date's Order record
  const dayStart = new Date(targetDate);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  let order = await Order.findOne({
    customer: req.user._id,
    date: { $gte: dayStart, $lte: dayEnd },
    mealTime,
  });

  if (order) {
    order.foodItem = foodItemId;
    order.deliverySlot = deliverySlotId;
    await order.save();
  } else {
    order = await Order.create({
      customer: req.user._id,
      subscription: subscription._id,
      date: targetDate,
      mealTime,
      foodItem: foodItemId,
      deliverySlot: deliverySlotId,
      deliveryAddress: req.user.address,
      status: 'pending',
      messId: req.user.messId,
    });
  }

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
  );

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No active subscription found.' });
  }

  res.status(200).json({
    success: true,
    message: 'Subscription paused successfully',
    data: subscription,
  });
};

// @desc    Cancel subscription
// @route   POST /api/customer/subscription/cancel
// @access  Private (Customer)
const cancelSubscription = async (req, res) => {
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ['active', 'paused'] },
  });

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No subscription found to cancel.' });
  }

  if (subscription.stripeSubscriptionId) {
    await cancelStripeSubscription(subscription.stripeSubscriptionId);
  }

  subscription.status = 'cancelled';
  await subscription.save();

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully',
    data: subscription,
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
  cancelSubscription,
  getMyOrders,
};
