const express = require('express');
const router = express.Router();
const {
  register,
  adminRegister,
  login,
  refreshToken,
  getMe,
  updateMe,
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

// 10 attempts per IP per 15 minutes on credential endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/register', authLimiter, register);
router.post('/admin/register', protect, requireRole('admin'), adminRegister);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
