const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  jwtSecret,
  jwtRefreshSecret,
  jwtExpiresIn,
  jwtRefreshExpiresIn,
} = require('../config/env');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    jwtRefreshSecret,
    { expiresIn: jwtRefreshExpiresIn }
  );
};

// @desc    Register customer
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password, phone, address, expoPushToken } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, and password.',
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.',
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'An account with this email address already exists.',
    });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: password,
    role: 'customer',
    phone,
    address,
    expoPushToken,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
    },
  });
};

// @desc    Register admin (mess owner)
// @route   POST /api/auth/admin/register
// @access  Private (Admin) - only an existing admin can create another
const adminRegister = async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, and password.',
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.',
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'An account with this email address already exists.',
    });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: password,
    role: 'admin',
    phone,
    address,
    messId: req.user.messId,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(201).json({
    success: true,
    message: 'Admin account created successfully',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
    },
  });
};

// @desc    Login user (both admin and customer)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password.',
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials.',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials.',
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      messId: user.messId,
    },
  });
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required.',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtRefreshSecret);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.',
      });
    }

    const accessToken = generateAccessToken(user);
    res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Expired or invalid refresh token.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
};

// @desc    Update current user profile
// @route   PUT /api/auth/me
// @access  Private
const updateMe = async (req, res) => {
  const { name, phone, address, expoPushToken } = req.body;

  if (name) req.user.name = name;
  if (phone) req.user.phone = phone;
  if (address) req.user.address = { ...req.user.address, ...address };
  if (expoPushToken) req.user.expoPushToken = expoPushToken;

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: req.user,
  });
};

module.exports = {
  register,
  adminRegister,
  login,
  refreshToken,
  getMe,
  updateMe,
};
