const express = require('express');
const router = express.Router();
const {
  getWeekPlan,
  saveWeekSelection,
  getMyBills,
  getMyOrders,
} = require('../controllers/customer.controller');
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Public route (week includes the customer's order when signed in)
router.get('/week', optionalAuth, getWeekPlan);

// Protected routes for customers
router.use(protect);
router.use(requireRole('customer'));

// Weekly orders & bills
router.post('/selection/week', saveWeekSelection);
router.get('/bills', getMyBills);

// Customer Orders
router.get('/orders', getMyOrders);

module.exports = router;
