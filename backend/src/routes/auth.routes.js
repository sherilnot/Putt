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

router.post('/register', register);
router.post('/admin/register', adminRegister);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
