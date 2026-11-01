const FoodItem = require('../models/FoodItem');
const WeeklyMenu = require('../models/WeeklyMenu');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const DeliverySlot = require('../models/DeliverySlot');
const { notifyOrderStatusChange } = require('../services/notification.service');
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

// Only copy whitelisted fields from a request body (prevents overwriting createdBy, messId, etc.)
const pick = (body, fields) =>
  fields.reduce((acc, f) => (body[f] !== undefined ? { ...acc, [f]: body[f] } : acc), {});

const FOOD_FIELDS = ['name', 'description', 'imageUrl', 'category', 'dietType', 'price', 'isAvailable'];
const PLAN_FIELDS = ['name', 'description', 'priceAUD', 'intervalDays', 'mealsPerDay', 'dietTypes', 'isActive'];
const SLOT_FIELDS = ['label', 'mealTime', 'startTime', 'endTime', 'maxOrders', 'isActive'];
const MENU_FIELDS = ['title', 'days', 'isActive'];
const ORDER_STATUSES = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
const SUBSCRIPTION_STATUSES = ['pending', 'active', 'paused', 'cancelled', 'expired'];

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
const getDashboardStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [activeSubscribers, todaysOrders, pendingOrders, totalFoodItems] =
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
    ]);

  res.status(200).json({
    success: true,
    stats: {
      activeSubscribers,
      todaysOrders,
      pendingOrders,
      totalFoodItems,
    },
  });
};

// -------------------------------------------------------------
// FOOD ITEMS
// -------------------------------------------------------------
const getFoodItems = async (req, res) => {
  const { category, dietType, isAvailable } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (dietType) filter.dietType = dietType;
  if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

  const foodItems = await FoodItem.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: foodItems.length, data: foodItems });
};

const createFoodItem = async (req, res) => {
  const { name, description, imageUrl, category, dietType, price, isAvailable } =
    req.body;

  const foodItem = await FoodItem.create({
    name,
    description,
    imageUrl,
    category,
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
// WEEKLY MENU PLANNING & PUBLISHING
// -------------------------------------------------------------

// @desc    Get upcoming weeks list with menu status and deadlines
// @route   GET /api/admin/weeks
// @access  Private (Admin)
const getUpcomingWeeks = async (req, res) => {
  const now = new Date();
  const currentMonday = getWeekMonday(now);
  const weeks = [];

  for (let i = 0; i < 4; i++) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() + i * 7);
    const sunday = getWeekSunday(monday);
    const deadline = getSelectionDeadline(monday);
    const isLocked = isSelectionLocked(monday, now);

    // Look up menu in DB
    const menu = await WeeklyMenu.findOne({ weekStartDate: monday });

    let label = 'Upcoming Week';
    if (i === 0) label = 'Current Week (Active)';
    else if (i === 1) label = 'Next Week (Customer Selecting)';
    else if (i === 2) label = 'Week +2';
    else if (i === 3) label = 'Week +3';

    weeks.push({
      label,
      weekIndex: i,
      weekStartDate: monday,
      weekEndDate: sunday,
      selectionDeadline: deadline,
      selectionDeadlineFormatted: formatDeadline(deadline),
      isSelectionLocked: isLocked,
      menuId: menu ? menu._id : null,
      title: menu ? menu.title : `Menu for ${monday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      isPublished: menu ? menu.isPublished : false,
      status: menu ? menu.status : 'not_created',
    });
  }

  res.status(200).json({ success: true, data: weeks });
};

// @desc    Get menu for a specific week (or draft template if not created)
// @route   GET /api/admin/weekly-menu/by-week
// @access  Private (Admin)
const getWeeklyMenuByWeek = async (req, res) => {
  const { weekStartDate } = req.query;

  if (!weekStartDate) {
    return res.status(400).json({
      success: false,
      message: 'weekStartDate is required (e.g. 2026-09-21)',
    });
  }

  const targetMonday = getWeekMonday(new Date(weekStartDate));
  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);
  const isLocked = isSelectionLocked(targetMonday);

  let menu = await WeeklyMenu.findOne({ weekStartDate: targetMonday })
    .populate('days.meals.foodItems');

  if (!menu) {
    // Construct template with all 7 days and dates
    const weekDays = getDaysForWeek(targetMonday);
    const templateDays = weekDays.map((d) => ({
      dayName: d.dayName,
      date: d.date,
      meals: [
        { mealTime: 'breakfast', foodItems: [] },
        { mealTime: 'lunch', foodItems: [] },
        { mealTime: 'dinner', foodItems: [] },
      ],
    }));

    menu = {
      _id: null,
      title: `Menu for ${targetMonday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – ${targetSunday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      selectionDeadline: deadline,
      selectionDeadlineFormatted: formatDeadline(deadline),
      isSelectionLocked: isLocked,
      isPublished: false,
      status: 'draft',
      days: templateDays,
    };
  }

  res.status(200).json({
    success: true,
    data: menu,
    selectionDeadline: deadline,
    selectionDeadlineFormatted: formatDeadline(deadline),
    isSelectionLocked: isLocked,
  });
};

const getWeeklyMenus = async (req, res) => {
  const menus = await WeeklyMenu.find()
    .populate('days.meals.foodItems')
    .sort({ weekStartDate: -1 });
  res.status(200).json({ success: true, data: menus });
};

// @desc    Save/update menu draft for a week
// @route   POST /api/admin/weekly-menu/save-draft
// @access  Private (Admin)
const saveWeeklyMenuDraft = async (req, res) => {
  const { title, weekStartDate, days } = req.body;

  if (!weekStartDate || !days) {
    return res.status(400).json({
      success: false,
      message: 'weekStartDate and days are required',
    });
  }

  const targetMonday = getWeekMonday(new Date(weekStartDate));
  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);

  // Ensure dates are attached to days
  const weekDays = getDaysForWeek(targetMonday);
  const enrichedDays = days.map((day, idx) => ({
    ...day,
    date: day.date || weekDays[idx]?.date || targetMonday,
  }));

  let menu = await WeeklyMenu.findOne({ weekStartDate: targetMonday });

  if (menu) {
    menu.title = title || menu.title;
    menu.days = enrichedDays;
    menu.weekEndDate = targetSunday;
    menu.selectionDeadline = deadline;
    await menu.save();
  } else {
    menu = await WeeklyMenu.create({
      title: title || `Menu for ${targetMonday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      weekStartDate: targetMonday,
      weekEndDate: targetSunday,
      selectionDeadline: deadline,
      isPublished: false,
      status: 'draft',
      days: enrichedDays,
      createdBy: req.user._id,
      messId: req.user.messId,
    });
  }

  const populated = await WeeklyMenu.findById(menu._id).populate('days.meals.foodItems');
  res.status(200).json({
    success: true,
    message: 'Menu draft saved successfully',
    data: populated,
  });
};

// @desc    Publish menu for a week so customers can select meals
// @route   POST /api/admin/weekly-menu/publish
// @access  Private (Admin)
const publishWeeklyMenu = async (req, res) => {
  const { menuId, weekStartDate } = req.body;

  let query = {};
  if (menuId) query._id = menuId;
  else if (weekStartDate) query.weekStartDate = getWeekMonday(new Date(weekStartDate));
  else {
    return res.status(400).json({
      success: false,
      message: 'menuId or weekStartDate is required to publish',
    });
  }

  const menu = await WeeklyMenu.findOne(query);
  if (!menu) {
    return res.status(404).json({ success: false, message: 'Weekly menu not found' });
  }

  const targetMonday = getWeekMonday(menu.weekStartDate);
  const targetSunday = getWeekSunday(targetMonday);
  const deadline = getSelectionDeadline(targetMonday);

  menu.isPublished = true;
  menu.status = 'published';
  menu.weekEndDate = targetSunday;
  menu.selectionDeadline = deadline;
  await menu.save();

  const populated = await WeeklyMenu.findById(menu._id).populate('days.meals.foodItems');
  res.status(200).json({
    success: true,
    message: `Menu for week of ${targetMonday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} is now published! Customers can now select meals before ${formatDeadline(deadline)}.`,
    data: populated,
    selectionDeadline: deadline,
    selectionDeadlineFormatted: formatDeadline(deadline),
  });
};

const createWeeklyMenu = async (req, res) => {
  return saveWeeklyMenuDraft(req, res);
};

const updateWeeklyMenu = async (req, res) => {
  const menu = await WeeklyMenu.findByIdAndUpdate(req.params.id, pick(req.body, MENU_FIELDS), {
    new: true,
    runValidators: true,
  }).populate('days.meals.foodItems');

  if (!menu) {
    return res.status(404).json({ success: false, message: 'Weekly menu not found' });
  }

  res.status(200).json({ success: true, data: menu });
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
  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, pick(req.body, PLAN_FIELDS), {
    new: true,
    runValidators: true,
  });

  if (!plan) {
    return res.status(404).json({ success: false, message: 'Plan not found' });
  }

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
    .populate('defaultDeliverySlot')
    .populate('selectedMeals.foodItem')
    .populate('selectedMeals.deliverySlot')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
};

const updateSubscriptionStatus = async (req, res) => {
  const { status } = req.body;
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid subscription status' });
  }
  const subscription = await Subscription.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate('customer', 'name email');

  if (!subscription) {
    return res.status(404).json({ success: false, message: 'Subscription not found' });
  }

  if (['paused', 'cancelled', 'expired'].includes(status)) {
    await cancelFuturePendingOrders(subscription._id);
  }

  res.status(200).json({ success: true, data: subscription });
};

// -------------------------------------------------------------
// ORDERS
// -------------------------------------------------------------
const getOrders = async (req, res) => {
  const { date, slotId, status } = req.query;
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

  if (slotId) filter.deliverySlot = slotId;
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .populate('customer', 'name email phone address expoPushToken')
    .populate('foodItem')
    .populate('deliverySlot')
    .sort({ createdAt: -1 });

  // Group by delivery window: sort on the populated slot's start time ("HH:mm" sorts lexically)
  orders.sort((a, b) =>
    (a.deliverySlot?.startTime || '99:99').localeCompare(b.deliverySlot?.startTime || '99:99')
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
// DELIVERY SLOTS
// -------------------------------------------------------------
const getDeliverySlots = async (req, res) => {
  const slots = await DeliverySlot.find().sort({ startTime: 1 });
  res.status(200).json({ success: true, data: slots });
};

const createDeliverySlot = async (req, res) => {
  const { label, mealTime, startTime, endTime, maxOrders } = req.body;

  const slot = await DeliverySlot.create({
    label,
    mealTime,
    startTime,
    endTime,
    maxOrders: maxOrders || 50,
    messId: req.user.messId,
  });

  res.status(201).json({ success: true, data: slot });
};

const updateDeliverySlot = async (req, res) => {
  const slot = await DeliverySlot.findByIdAndUpdate(req.params.id, pick(req.body, SLOT_FIELDS), {
    new: true,
    runValidators: true,
  });

  if (!slot) {
    return res.status(404).json({ success: false, message: 'Delivery slot not found' });
  }

  res.status(200).json({ success: true, data: slot });
};

const deleteDeliverySlot = async (req, res) => {
  const slot = await DeliverySlot.findByIdAndDelete(req.params.id);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Delivery slot not found' });
  }
  res.status(200).json({ success: true, message: 'Delivery slot removed' });
};

module.exports = {
  getDashboardStats,
  getFoodItems,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  getUpcomingWeeks,
  getWeeklyMenuByWeek,
  saveWeeklyMenuDraft,
  publishWeeklyMenu,
  getWeeklyMenus,
  createWeeklyMenu,
  updateWeeklyMenu,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getAllSubscriptions,
  updateSubscriptionStatus,
  getOrders,
  updateOrderStatus,
  getDeliverySlots,
  createDeliverySlot,
  updateDeliverySlot,
  deleteDeliverySlot,
};
