const express = require('express');
const router = express.Router();
const {
  getWeekPlan,
  saveWeekSelection,
  getPlans,
  subscribe,
  getMySubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  getMyOrders,
} = require('../controllers/customer.controller');
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Public routes (week plan includes the customer's details when signed in)
router.get('/week', optionalAuth, getWeekPlan);
router.get('/plans', getPlans);

// Protected routes for customers
router.use(protect);
router.use(requireRole('customer'));

// Subscriptions & Meals
router.post('/subscribe', subscribe);
router.get('/subscription', getMySubscription);
router.post('/selection/week', saveWeekSelection);
router.post('/subscription/pause', pauseSubscription);
router.post('/subscription/resume', resumeSubscription);
router.post('/subscription/cancel', cancelSubscription);

// Customer Orders
router.get('/orders', getMyOrders);

module.exports = router;
