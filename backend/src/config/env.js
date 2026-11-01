require('dotenv').config();
const crypto = require('crypto');

// All week/cutoff maths uses local Date methods, so pin the process to the
// business timezone instead of whatever the host happens to run in.
process.env.TZ = process.env.APP_TIMEZONE || 'Australia/Sydney';

const isProduction = process.env.NODE_ENV === 'production';

const requireSecret = (name) => {
  if (process.env[name]) return process.env[name];
  if (isProduction) {
    throw new Error(`[Config] ${name} must be set in production.`);
  }
  // Dev only: random per-process secret, so tokens die on restart but can never be forged
  // from a value checked into the repo.
  console.warn(`[Config] ${name} is not set; using a random development secret.`);
  process.env[name] = crypto.randomBytes(32).toString('hex');
  return process.env[name];
};

module.exports = {
  isProduction,
  jwtSecret: requireSecret('JWT_SECRET'),
  jwtRefreshSecret: requireSecret('JWT_REFRESH_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : null,
};
