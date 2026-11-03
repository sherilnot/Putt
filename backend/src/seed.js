require('./config/env');
const mongoose = require('mongoose');
const User = require('./models/User');
const FoodItem = require('./models/FoodItem');
const PickupSlot = require('./models/PickupSlot');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const Subscription = require('./models/Subscription');
const Order = require('./models/Order');
const CustomerWeeklySelection = require('./models/CustomerWeeklySelection');
const { DEFAULT_PICKUP_SLOTS, DEFAULT_PLANS, DEFAULT_FOOD_ITEMS } = require('./data/defaults');
const { getWeekMonday } = require('./utils/weekUtils');

const seedData = async (exitOnComplete = true) => {
  // Wipes every collection and creates demo logins with public passwords
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Seed] Refusing to run in production. Use `npm run bootstrap` instead.');
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/puttum_kadalayum';
      await mongoose.connect(mongoUri);
      console.log('[Seed] Connected to MongoDB');
    }

    // Clean existing
    await User.deleteMany({});
    await FoodItem.deleteMany({});
    await PickupSlot.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    await Subscription.deleteMany({});
    await Order.deleteMany({});
    await CustomerWeeklySelection.deleteMany({});
    console.log('[Seed] Cleared existing data');

    // 1. Create Admin
    const admin = await User.create({
      name: 'Mess Owner (George)',
      email: 'admin@puttumkadalayum.com.au',
      passwordHash: 'Admin123!',
      role: 'admin',
      phone: '+61 412 345 678',
    });

    // 2. Create Sample Customer
    const customer = await User.create({
      name: 'Demo Customer',
      email: 'customer@example.com',
      passwordHash: 'Customer123!',
      role: 'customer',
      phone: '+61 498 765 432',
    });
    console.log('[Seed] Admin and Customer created');

    // 3. Create Pickup Windows
    await PickupSlot.create(DEFAULT_PICKUP_SLOTS);
    console.log('[Seed] Pickup windows created');

    // 4. Create Subscription Plans (AUD)
    const plans = await SubscriptionPlan.create(DEFAULT_PLANS);
    console.log('[Seed] Subscription plans created');

    // 5. Create Food Items
    const foodItems = await FoodItem.create(
      DEFAULT_FOOD_ITEMS.map((item) => ({ ...item, createdBy: admin._id }))
    );
    console.log(`[Seed] ${foodItems.length} Food items created`);

    const currentMonday = getWeekMonday(new Date());

    // Demo customer gets an active 3-meals-a-day plan so they can choose meals right away
    await Subscription.create({
      customer: customer._id,
      plan: plans.find((p) => p.mealsPerDay === 3)._id,
      startDate: currentMonday,
      endDate: new Date(currentMonday.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    });

    console.log('[Seed] Demo customer subscription created');

    console.log('\n======================================');
    console.log('SEED COMPLETED SUCCESSFULLY');
    console.log('Admin Credentials: admin@puttumkadalayum.com.au / Admin123!');
    console.log('Customer Credentials: customer@example.com / Customer123!');
    console.log('======================================\n');

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    console.error('[Seed] Error seeding data:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedData(true);
}

module.exports = { seedData };
