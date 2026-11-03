const config = require('./src/config/env');
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./src/middlewares/error.middleware');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const customerRoutes = require('./src/routes/customer.routes');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    // Native apps send no Origin header; this only restricts browsers.
    origin: config.corsOrigins || !config.isProduction,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging
if (!config.isProduction && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Landing page so visiting the bare domain doesn't look like an error
app.get('/', (req, res) => {
  res
    .status(200)
    .type('html')
    .send(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
        '<title>Puttum Beefum API</title>' +
        '<body style="font-family:system-ui;margin:3rem auto;max-width:32rem;padding:0 1rem;line-height:1.5">' +
        '<h1>🍛 Puttum Beefum API</h1><p>✅ The server is running. Open the Puttum Beefum app to order meals.</p>' +
        '<p><a href="/api/health">Health check</a></p></body>'
    );
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    app: 'Puttum Beefum Backend',
    region: 'Australia (AEST)',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
