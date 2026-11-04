require('./config/env');
const mongoose = require('mongoose');
const User = require('./models/User');
const FoodItem = require('./models/FoodItem');
const PickupSlot = require('./models/PickupSlot');
const Order = require('./models/Order');
const CustomerWeeklySelection = require('./models/CustomerWeeklySelection');
const WeeklyMenu = require('./models/WeeklyMenu');
const { DEFAULT_PICKUP_SLOTS, DEFAULT_FOOD_ITEMS } = require('./data/defaults');
const { getWeekMonday, getDaysForWeek } = require('./utils/weekUtils');

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
    await Order.deleteMany({});
    await CustomerWeeklySelection.deleteMany({});
    await WeeklyMenu.deleteMany({});
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
    await User.create({
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

    // 4. Create Food Items (demo prices; the manager sets the real ones)
    const foodItems = await FoodItem.create(
      DEFAULT_FOOD_ITEMS.map((item, i) => ({ ...item, price: 14 + (i % 4) * 2, createdBy: admin._id }))
    );
    console.log(`[Seed] ${foodItems.length} Food items created`);

    // 5. Demo menus: 3 dishes a day for this week and the next three
    const thisMonday = getWeekMonday(new Date());
    for (let w = 0; w < 4; w += 1) {
      const monday = new Date(thisMonday);
      monday.setDate(monday.getDate() + w * 7);
      await WeeklyMenu.create({
        weekStartDate: monday,
        updatedBy: admin._id,
        days: getDaysForWeek(monday).map(({ dayName, date }, d) => ({
          dayName,
          date,
          dishes: [0, 1, 2].map((k) => foodItems[(w * 7 + d + k * 5) % foodItems.length]._id),
        })),
      });
    }
    console.log('[Seed] Demo weekly menus created');

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
