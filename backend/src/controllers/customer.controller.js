const mongoose = require('mongoose');
const Order = require('../models/Order');
const PickupSlot = require('../models/PickupSlot');
const WeeklyMenu = require('../models/WeeklyMenu');
const CustomerWeeklySelection = require('../models/CustomerWeeklySelection');
const {
  getWeekMonday,
  getWeekSunday,
  getChoiceWindow,
  getFirstOpenWeekMonday,
  getDaysForWeek,
  formatDeadline,
} = require('../utils/weekUtils');

const MAX_MEALS_PER_DAY = 3;

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

const shortDate = (d) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Make the customer's pending orders for one day match their chosen dishes:
 * one order per meal (2 × Biriyani is two orders), all collected in the same pickup window.
 */
const syncDayOrders = async ({ user, date, items, pickupSlot }) => {
  const meals = items.flatMap((i) => Array(i.quantity).fill(i.foodItem));
  const existing = await Order.find({
    customer: user._id,
    date: dayRange(date),
    status: { $ne: 'cancelled' },
  });

  const mealDate = new Date(date);
  mealDate.setHours(12, 0, 0, 0);

  for (let i = 0; i < MAX_MEALS_PER_DAY; i += 1) {
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

const loadMenu = (monday) =>
  WeeklyMenu.findOne({ weekStartDate: monday }).populate('days.dishes');

// @desc    Everything needed to order a week: the manager's dishes per day (with prices),
//          pickup windows, the Wednesday–Thursday window, and the customer's saved order
// @route   GET /api/customer/week?weekStartDate=YYYY-MM-DD (defaults to the next week open for ordering)
// @access  Public (customer's order included when authenticated)
const getWeekPlan = async (req, res) => {
  const now = new Date();
  const { weekStartDate } = req.query;
  const monday = weekStartDate ? getWeekMonday(new Date(weekStartDate)) : getFirstOpenWeekMonday(now);
  const { opensAt, closesAt } = getChoiceWindow(monday);

  const [menu, pickupSlots, selection] = await Promise.all([
    loadMenu(monday),
    PickupSlot.find({ isActive: true }).sort({ startTime: 1 }),
    req.user ? CustomerWeeklySelection.findOne({ customer: req.user._id, weekStartDate: monday }) : null,
  ]);

  res.status(200).json({
    success: true,
    data: {
      weekStartDate: monday,
      weekEndDate: getWeekSunday(monday),
      opensAt,
      selectionDeadline: closesAt,
      selectionDeadlineFormatted: formatDeadline(closesAt),
      isOpen: now >= opensAt && now <= closesAt,
      isLocked: now > closesAt,
      menuDays: getDaysForWeek(monday).map(({ dayName, date }) => ({
        dayName,
        date,
        dishes: (menu?.days.find((d) => d.dayName === dayName)?.dishes || []).filter(Boolean),
      })),
      // Leftover menus from older app versions can exist with no dishes
      hasMenu: Boolean(menu?.days.some((d) => d.dishes?.length)),
      pickupSlots,
      maxMealsPerDay: MAX_MEALS_PER_DAY,
      selection,
    },
  });
};

// @desc    Save a week of meals. Each day: up to 3 meals from that day's menu and one pickup window.
//          The bill is the sum of the dish prices.
// @route   POST /api/customer/selection/week
// @body    { weekStartDate, days: [{ dayName, items: [{ foodItem, quantity }], pickupSlot }] }
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
  const monday = getWeekMonday(new Date(weekStartDate));
  const { opensAt, closesAt } = getChoiceWindow(monday);

  // 1. Wednesday → Thursday 11:59 PM only
  if (now < opensAt) {
    throw new ValidationError(`Ordering for this week opens on ${shortDate(opensAt)}.`, 'SELECTION_NOT_OPEN');
  }
  if (now > closesAt) {
    return res.status(400).json({
      success: false,
      code: 'SELECTION_LOCKED',
      message: `Orders for the week of ${shortDate(monday)} closed on Thursday at 11:59 PM.`,
      deadline: formatDeadline(closesAt),
    });
  }

  // 2. The manager's menu for that week
  const menu = await loadMenu(monday);
  if (!menu?.days.some((d) => d.dishes?.length)) throw new ValidationError("This week's menu isn't ready yet.", 'NO_MENU');

  const activeSlots = new Set(
    (await PickupSlot.find({ isActive: true }).select('_id')).map((s) => s._id.toString())
  );

  // 3. Validate each day and price it
  const weekDays = getDaysForWeek(monday);
  const normalized = [];
  let totalAUD = 0;
  for (const choice of days) {
    const weekDay = weekDays.find((d) => d.dayName === choice.dayName);
    if (!weekDay) throw new ValidationError(`Unknown day "${choice.dayName}".`);
    const offered = menu.days.find((d) => d.dayName === choice.dayName)?.dishes.filter(Boolean) || [];

    // Merge repeated dishes into one line each
    const quantities = new Map();
    for (const item of choice.items || []) {
      const qty = Number(item?.quantity);
      if (!mongoose.isValidObjectId(item?.foodItem) || !Number.isInteger(qty) || qty < 1) {
        throw new ValidationError(`Something is wrong with ${choice.dayName}'s order.`);
      }
      const id = String(item.foodItem);
      quantities.set(id, (quantities.get(id) || 0) + qty);
    }

    const mealCount = [...quantities.values()].reduce((a, b) => a + b, 0);
    if (mealCount > MAX_MEALS_PER_DAY) {
      throw new ValidationError(
        `Up to ${MAX_MEALS_PER_DAY} meals a day; ${choice.dayName} has ${mealCount}.`,
        'DAY_LIMIT'
      );
    }

    const items = [...quantities].map(([id, quantity]) => {
      const dish = offered.find((d) => d._id.toString() === id);
      if (!dish) throw new ValidationError(`A dish chosen for ${choice.dayName} isn't on that day's menu.`, 'NOT_ON_MENU');
      if (!dish.isAvailable) throw new ValidationError(`${dish.name} is no longer available.`);
      totalAUD += dish.price * quantity;
      return { foodItem: dish._id, quantity, price: dish.price };
    });

    if (items.length > 0 && (!choice.pickupSlot || !activeSlots.has(String(choice.pickupSlot)))) {
      throw new ValidationError(`Choose a pickup time for ${choice.dayName}.`, 'PICKUP_REQUIRED');
    }

    normalized.push({
      dayName: choice.dayName,
      date: weekDay.date, // trust server-computed dates, not the client's
      items,
      pickupSlot: items.length > 0 ? choice.pickupSlot : null,
    });
  }

  // 4. Save the week. A bill that changes after it was paid goes back to unpaid.
  const previous = await CustomerWeeklySelection.findOne({ customer: req.user._id, weekStartDate: monday });
  const keepPayment = previous?.payment?.status === 'paid' && previous.totalAUD === totalAUD;

  const selection = await CustomerWeeklySelection.findOneAndUpdate(
    { customer: req.user._id, weekStartDate: monday },
    {
      customer: req.user._id,
      weekStartDate: monday,
      weekEndDate: getWeekSunday(monday),
      days: normalized,
      totalAUD,
      submittedAt: now,
      ...(keepPayment ? {} : { payment: { status: 'unpaid' } }),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // 5. Kitchen orders follow the choices
  for (const day of normalized) {
    await syncDayOrders({ user: req.user, ...day });
  }

  res.status(200).json({
    success: true,
    message: totalAUD > 0
      ? `Order saved. Your bill for the week is $${totalAUD.toFixed(2)}. Pay the mess by cash, bank transfer or PayID.`
      : 'Saved. No meals ordered for this week.',
    data: selection,
    selectionDeadlineFormatted: formatDeadline(closesAt),
  });
};

// @desc    The customer's weekly bills, newest first
// @route   GET /api/customer/bills
// @access  Private (Customer)
const getMyBills = async (req, res) => {
  const bills = await CustomerWeeklySelection.find({ customer: req.user._id, totalAUD: { $gt: 0 } })
    .populate('days.items.foodItem', 'name dietType')
    .populate('days.pickupSlot', 'label')
    .sort({ weekStartDate: -1 })
    .limit(26);

  res.status(200).json({ success: true, count: bills.length, data: bills });
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
  getMyBills,
  getMyOrders,
};
