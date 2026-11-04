const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/admin.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Protect all admin routes
router.use(protect);
router.use(requireRole('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Food Items
router.route('/food-items').get(getFoodItems).post(createFoodItem);
router.route('/food-items/:id').put(updateFoodItem).delete(deleteFoodItem);

// Weekly menu (3 dishes a day)
router.route('/menu').get(getWeeklyMenu).put(saveWeeklyMenu);

// Weekly bills
router.get('/bills', getBills);
router.put('/bills/:id/payment', setBillPayment);

// Orders
router.route('/orders').get(getOrders);
router.route('/orders/:id/status').put(updateOrderStatus);

// Pickup Windows
router.route('/pickup-slots').get(getPickupSlots).post(createPickupSlot);
router.route('/pickup-slots/:id').put(updatePickupSlot).delete(deletePickupSlot);

module.exports = router;
