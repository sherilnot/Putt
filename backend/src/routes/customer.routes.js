const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/customer.controller');
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Public routes for menu/plans viewing
router.get('/menu/week', getWeeklyMenu);
router.get('/menu/upcoming', optionalAuth, getUpcomingWeekMenu);
router.get('/plans', getPlans);
router.get('/delivery-slots', getDeliverySlots);

// Protected routes for customers
router.use(protect);
router.use(requireRole('customer'));

// Subscriptions & Meals
router.post('/subscribe', subscribe);
router.get('/subscription', getMySubscription);
router.put('/subscription/meal', selectMeal);
router.post('/selection/week', saveCustomerWeeklySelection);
router.post('/subscription/pause', pauseSubscription);
router.post('/subscription/resume', resumeSubscription);
router.post('/subscription/cancel', cancelSubscription);

// Customer Orders
router.get('/orders', getMyOrders);

module.exports = router;
