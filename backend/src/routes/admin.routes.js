const express = require('express');
const router = express.Router();
const {
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

// Weekly Menus & Planning
router.get('/weeks', getUpcomingWeeks);
router.get('/weekly-menu/by-week', getWeeklyMenuByWeek);
router.post('/weekly-menu/save-draft', saveWeeklyMenuDraft);
router.post('/weekly-menu/publish', publishWeeklyMenu);
router.route('/weekly-menu').get(getWeeklyMenus).post(createWeeklyMenu);
router.route('/weekly-menu/:id').put(updateWeeklyMenu);

// Subscription Plans
router.route('/plans').get(getPlans).post(createPlan);
router.route('/plans/:id').put(updatePlan).delete(deletePlan);

// Subscriptions
router.route('/subscriptions').get(getAllSubscriptions);
router.route('/subscriptions/:id/status').put(updateSubscriptionStatus);

// Orders
router.route('/orders').get(getOrders);
router.route('/orders/:id/status').put(updateOrderStatus);

// Delivery Slots
router.route('/delivery-slots').get(getDeliverySlots).post(createDeliverySlot);
router
  .route('/delivery-slots/:id')
  .put(updateDeliverySlot)
  .delete(deleteDeliverySlot);

module.exports = router;
