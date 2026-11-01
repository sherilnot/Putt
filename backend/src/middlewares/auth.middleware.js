const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret } = require('../config/env');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired. Please refresh your token.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid token.',
    });
  }
};

// Attach req.user when a valid token is present, but never reject the request.
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], jwtSecret);
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    } catch (err) {
      // Invalid/expired token: treat as anonymous
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
