const mongoose = require('mongoose');
const FoodItem = require('../models/FoodItem');
const Order = require('../models/Order');
const PickupSlot = require('../models/PickupSlot');
const User = require('../models/User');
const WeeklyMenu = require('../models/WeeklyMenu');
const CustomerWeeklySelection = require('../models/CustomerWeeklySelection');
const { notifyOrderStatusChange } = require('../services/notification.service');
const {
  getWeekMonday,
  getWeekSunday,
  getMenuWindow,
  getMenuWeekMonday,
  getChoiceWindow,
  getFirstOpenWeekMonday,
  getDaysForWeek,
  formatDeadline,
} = require('../utils/weekUtils');

// Only copy whitelisted fields from a request body (prevents overwriting createdBy, messId, etc.)
const pick = (body, fields) =>
  fields.reduce((acc, f) => (body[f] !== undefined ? { ...acc, [f]: body[f] } : acc), {});

const FOOD_FIELDS = ['name', 'description', 'imageUrl', 'dietType', 'price', 'isAvailable'];
const SLOT_FIELDS = ['label', 'startTime', 'endTime', 'maxOrders', 'isActive'];
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'collected', 'cancelled'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'payid', 'other'];
const DISHES_PER_DAY = 3;

const shortDate = (d) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

/** The latest week whose ordering window has opened: the bills the manager is collecting now */
const getBillingWeekMonday = (now = new Date()) => {
  const monday = getFirstOpenWeekMonday(now);
  if (getChoiceWindow(monday).opensAt > now) monday.setDate(monday.getDate() - 7);
  return monday;
};

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
const getDashboardStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const menuWeek = getMenuWeekMonday();

  const [customers, todaysOrders, pendingOrders, totalFoodItems, unpaidBills, menuSet] =
    await Promise.all([
      User.countDocuments({ role: 'customer' }),
      Order.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: { $ne: 'cancelled' } }),
      Order.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'pending' }),
      FoodItem.countDocuments(),
      CustomerWeeklySelection.countDocuments({ totalAUD: { $gt: 0 }, 'payment.status': { $ne: 'paid' } }),
      WeeklyMenu.exists({ weekStartDate: menuWeek }),
    ]);

  res.status(200).json({
    success: true,
    stats: {
      customers,
      todaysOrders,
      pendingOrders,
      totalFoodItems,
      unpaidBills,
      menuWeekStartDate: menuWeek,
      menuSet: Boolean(menuSet),
      menuDeadline: getMenuWindow(menuWeek).closesAt,
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
// WEEKLY MENU (up to 3 dishes a day, set Sunday → Monday 11:59 PM for the following week)
// -------------------------------------------------------------
const menuResponse = async (monday) => {
  const menu = await WeeklyMenu.findOne({ weekStartDate: monday });
  const { opensAt, closesAt } = getMenuWindow(monday);
  const now = new Date();
  return {
    weekStartDate: monday,
    weekEndDate: getWeekSunday(monday),
    opensAt,
    closesAt,
    deadlineFormatted: formatDeadline(closesAt),
    isOpen: now >= opensAt && now <= closesAt,
    isLocked: now > closesAt,
    isSet: Boolean(menu),
    days: getDaysForWeek(monday).map(({ dayName, date }) => ({
      dayName,
      date,
      dishes: menu?.days.find((d) => d.dayName === dayName)?.dishes || [],
    })),
  };
};

// @route   GET /api/admin/menu?weekStartDate=YYYY-MM-DD (defaults to the week being set now or next)
const getWeeklyMenu = async (req, res) => {
  const { weekStartDate } = req.query;
  const monday = weekStartDate ? getWeekMonday(new Date(weekStartDate)) : getMenuWeekMonday();
  res.status(200).json({ success: true, data: await menuResponse(monday) });
};

// @route   PUT /api/admin/menu
// @body    { weekStartDate, days: [{ dayName, dishes: [foodItemId] }] }
const saveWeeklyMenu = async (req, res) => {
  const { weekStartDate, days } = req.body;
  if (!weekStartDate || !Array.isArray(days)) {
    return res.status(400).json({ success: false, message: 'weekStartDate and days array are required.' });
  }

  const now = new Date();
  const monday = getWeekMonday(new Date(weekStartDate));
  const { opensAt, closesAt } = getMenuWindow(monday);
  if (now < opensAt) {
    return res.status(400).json({
      success: false,
      code: 'MENU_NOT_OPEN',
      message: `The menu for the week of ${shortDate(monday)} can be set from ${shortDate(opensAt)}.`,
    });
  }
  if (now > closesAt) {
    return res.status(400).json({
      success: false,
      code: 'MENU_LOCKED',
      message: `The menu for the week of ${shortDate(monday)} closed on ${formatDeadline(closesAt)}.`,
    });
  }

  const ids = days.flatMap((d) => d.dishes || []).map(String);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ success: false, message: 'One of the dishes is invalid.' });
  }
  const known = new Set(
    (await FoodItem.find({ _id: { $in: ids } }).select('_id')).map((f) => f._id.toString())
  );

  const weekDays = getDaysForWeek(monday);
  const normalized = [];
  for (const day of days) {
    const weekDay = weekDays.find((d) => d.dayName === day.dayName);
    if (!weekDay) return res.status(400).json({ success: false, message: `Unknown day "${day.dayName}".` });
    const dishes = [...new Set((day.dishes || []).map(String))];
    if (dishes.length > DISHES_PER_DAY) {
      return res.status(400).json({
        success: false,
        code: 'DAY_LIMIT',
        message: `Up to ${DISHES_PER_DAY} dishes a day; ${day.dayName} has ${dishes.length}.`,
      });
    }
    if (dishes.some((id) => !known.has(id))) {
      return res.status(400).json({ success: false, message: `A dish for ${day.dayName} no longer exists.` });
    }
    normalized.push({ dayName: day.dayName, date: weekDay.date, dishes });
  }

  await WeeklyMenu.findOneAndUpdate(
    { weekStartDate: monday },
    { weekStartDate: monday, days: normalized, updatedBy: req.user._id },
    { upsert: true, new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: `Menu saved. Customers can order from ${shortDate(getChoiceWindow(monday).opensAt)}.`,
    data: await menuResponse(monday),
  });
};

// -------------------------------------------------------------
// BILLS (each customer's week of meals, paid offline)
// -------------------------------------------------------------
// @route   GET /api/admin/bills?weekStartDate=YYYY-MM-DD (defaults to the latest week open for orders)
const getBills = async (req, res) => {
  const { weekStartDate } = req.query;
  const monday = weekStartDate ? getWeekMonday(new Date(weekStartDate)) : getBillingWeekMonday();
  const { opensAt, closesAt } = getChoiceWindow(monday);

  const bills = await CustomerWeeklySelection.find({ weekStartDate: monday, totalAUD: { $gt: 0 } })
    .populate('customer', 'name email phone')
    .populate('days.items.foodItem', 'name dietType')
    .populate('days.pickupSlot', 'label startTime');
  bills.sort(
    (a, b) =>
      Number(a.payment?.status === 'paid') - Number(b.payment?.status === 'paid') ||
      (a.customer?.name || '').localeCompare(b.customer?.name || '')
  );

  const total = bills.reduce((n, b) => n + b.totalAUD, 0);
  const paid = bills.filter((b) => b.payment?.status === 'paid').reduce((n, b) => n + b.totalAUD, 0);
  const now = new Date();

  res.status(200).json({
    success: true,
    data: {
      weekStartDate: monday,
      weekEndDate: getWeekSunday(monday),
      ordersOpen: now >= opensAt && now <= closesAt,
      ordersClosed: now > closesAt,
      deadlineFormatted: formatDeadline(closesAt),
      summary: { bills: bills.length, totalAUD: total, paidAUD: paid, unpaidAUD: total - paid },
      bills,
    },
  });
};

// @route   PUT /api/admin/bills/:id/payment
// @body    { paid: true, method, reference } or { paid: false } to undo
const setBillPayment = async (req, res) => {
  const { paid, method, reference } = req.body;
  const bill = await CustomerWeeklySelection.findById(req.params.id);
  if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

  if (paid) {
    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`,
      });
    }
    bill.payment = { status: 'paid', method, reference: reference || '', paidAt: new Date(), confirmedBy: req.user._id };
  } else {
    bill.payment = { status: 'unpaid' };
  }
  await bill.save();
  await bill.populate([
    { path: 'customer', select: 'name email phone' },
    { path: 'days.items.foodItem', select: 'name dietType' },
    { path: 'days.pickupSlot', select: 'label startTime' },
  ]);

  res.status(200).json({
    success: true,
    message: paid ? `Payment of $${bill.totalAUD.toFixed(2)} recorded.` : 'Marked as unpaid.',
    data: bill,
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
  getWeeklyMenu,
  saveWeeklyMenu,
  getBills,
  setBillPayment,
  getOrders,
  updateOrderStatus,
  getPickupSlots,
  createPickupSlot,
  updatePickupSlot,
  deletePickupSlot,
};
