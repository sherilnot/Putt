/**
 * Safe, idempotent first-run setup for a real (production) database.
 * Unlike seed.js it never deletes anything and creates no demo accounts:
 *  - creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet
 *  - creates the default pickup windows if there are none
 *
 * Runs before every start on Render; after the first run it does nothing.
 */
require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const PickupSlot = require('../models/PickupSlot');
const { DEFAULT_PICKUP_SLOTS } = require('../data/defaults');

const bootstrap = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);

  if (!(await User.exists({ role: 'admin' }))) {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('No admin exists yet: set ADMIN_EMAIL and ADMIN_PASSWORD to create one.');
    }
    if (ADMIN_PASSWORD.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    }
    await User.create({
      name: ADMIN_NAME || 'Mess Owner',
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash: ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log(`[Bootstrap] Created admin ${ADMIN_EMAIL}`);
  }

  if ((await PickupSlot.countDocuments()) === 0) {
    await PickupSlot.create(DEFAULT_PICKUP_SLOTS);
    console.log('[Bootstrap] Created default pickup windows');
  }

  console.log('[Bootstrap] Done');
  await mongoose.disconnect();
};

bootstrap().catch((err) => {
  console.error(`[Bootstrap] Failed: ${err.message}`);
  process.exit(1);
});
