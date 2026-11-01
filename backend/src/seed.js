require('./config/env');
const mongoose = require('mongoose');
const User = require('./models/User');
const FoodItem = require('./models/FoodItem');
const DeliverySlot = require('./models/DeliverySlot');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const Subscription = require('./models/Subscription');
const WeeklyMenu = require('./models/WeeklyMenu');
const { DEFAULT_SLOTS, DEFAULT_PLANS } = require('./data/defaults');

const seedData = async (exitOnComplete = true) => {
  // Wipes every collection and creates demo logins with public passwords
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Seed] Refusing to run in production. Use `npm run bootstrap` instead.');
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/puttum_beefum';
      await mongoose.connect(mongoUri);
      console.log('[Seed] Connected to MongoDB');
    }

    // Clean existing
    await User.deleteMany({});
    await FoodItem.deleteMany({});
    await DeliverySlot.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    await WeeklyMenu.deleteMany({});
    console.log('[Seed] Cleared existing data');

    // 1. Create Admin
    const admin = await User.create({
      name: 'Mess Owner (George)',
      email: 'admin@puttumbeefum.com.au',
      passwordHash: 'Admin123!',
      role: 'admin',
      phone: '+61 412 345 678',
      address: {
        street: '124 George Street',
        suburb: 'Parramatta',
        state: 'NSW',
        postcode: '2150',
        country: 'Australia',
      },
    });

    // 2. Create Sample Customer
    const customer = await User.create({
      name: 'Andi Mathew',
      email: 'andi@example.com.au',
      passwordHash: 'Customer123!',
      role: 'customer',
      phone: '+61 498 765 432',
      address: {
        street: '45 Station Road',
        suburb: 'Harris Park',
        state: 'NSW',
        postcode: '2150',
        country: 'Australia',
      },
    });
    console.log('[Seed] Admin and Customer created');

    // 3. Create Delivery Slots
    const slots = await DeliverySlot.create(DEFAULT_SLOTS);
    console.log('[Seed] Delivery slots created');

    // 4. Create Subscription Plans (AUD)
    const plans = await SubscriptionPlan.create(DEFAULT_PLANS);
    console.log('[Seed] Subscription plans created');

    // 5. Create Food Items
    const foodItems = await FoodItem.create([
      {
        name: 'Puttu & Beef Roast',
        description: 'Steamed rice cake cylindrical cylinders served with slow-roasted spicy Kerala beef.',
        category: 'breakfast',
        dietType: 'non-veg',
        price: 16.5,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop',
      },
      {
        name: 'Appam & Chicken Stew',
        description: 'Soft-centered fermented rice pancakes with fragrant coconut milk chicken stew.',
        category: 'breakfast',
        dietType: 'non-veg',
        price: 15.0,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop',
      },
      {
        name: 'Idli, Sambar & Coconut Chutney',
        description: 'Steamed fluffy rice and lentil cakes with spiced vegetable stew and fresh coconut chutney.',
        category: 'breakfast',
        dietType: 'veg',
        price: 12.0,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop',
      },
      {
        name: 'Traditional Kerala Meals (Fish Curry)',
        description: 'Red Matta rice served with spicy Alleppey fish curry, thoran, avial, sambar, and pickle.',
        category: 'lunch',
        dietType: 'non-veg',
        price: 18.5,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop',
      },
      {
        name: 'Kerala Veg Sadhya Lunch',
        description: 'Steamed rice, parippu, sambar, avial, thoran, moru curry, papadam, and payasam.',
        category: 'lunch',
        dietType: 'veg',
        price: 16.0,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop',
      },
      {
        name: 'Malabar Chicken Dum Biryani',
        description: 'Khaima rice cooked on dum with tender chicken, ghee, fried onions, and sultanas.',
        category: 'lunch',
        dietType: 'non-veg',
        price: 19.0,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop',
      },
      {
        name: 'Malabar Parotta & Beef Curry',
        description: 'Flaky layered Kerala parotta served with aromatic rich beef gravy.',
        category: 'dinner',
        dietType: 'non-veg',
        price: 17.5,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop',
      },
      {
        name: 'Chapati & Paneer Butter Masala',
        description: 'Whole wheat flatbreads with rich cottage cheese in tomato cashew cream gravy.',
        category: 'dinner',
        dietType: 'veg',
        price: 15.5,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop',
      },
      {
        name: 'Ghee Rice & Mutton Kurma',
        description: 'Aromatic short-grain rice sautéed in pure ghee served with succulent goat kurma.',
        category: 'dinner',
        dietType: 'non-veg',
        price: 21.0,
        createdBy: admin._id,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop',
      },
    ]);
    console.log(`[Seed] ${foodItems.length} Food items created`);

    // 6. Build Weekly Menus using weekUtils
    const {
      getWeekMonday,
      getNextWeekMonday,
      getWeekSunday,
      getSelectionDeadline,
      getDaysForWeek,
    } = require('./utils/weekUtils');

    const daysOfWeek = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    const breakfastItems = foodItems.filter((f) => f.category === 'breakfast').map((f) => f._id);
    const lunchItems = foodItems.filter((f) => f.category === 'lunch').map((f) => f._id);
    const dinnerItems = foodItems.filter((f) => f.category === 'dinner').map((f) => f._id);

    const buildDayMeals = (startDate) => {
      const weekDays = getDaysForWeek(startDate);
      return weekDays.map((d) => ({
        dayName: d.dayName,
        date: d.date,
        meals: [
          { mealTime: 'breakfast', foodItems: breakfastItems },
          { mealTime: 'lunch', foodItems: lunchItems },
          { mealTime: 'dinner', foodItems: dinnerItems },
        ],
      }));
    };

    const currentMonday = getWeekMonday(new Date());
    const nextMonday = getNextWeekMonday(new Date());

    // Menu A: Current Week
    await WeeklyMenu.create({
      title: 'Current Week Kerala Homestyle Menu',
      weekStartDate: currentMonday,
      weekEndDate: getWeekSunday(currentMonday),
      selectionDeadline: getSelectionDeadline(currentMonday),
      isPublished: true,
      status: 'published',
      days: buildDayMeals(currentMonday),
      isActive: true,
      createdBy: admin._id,
    });

    // Menu B: Upcoming Week (Customers select for this week!)
    const nextDeadline = getSelectionDeadline(nextMonday);
    await WeeklyMenu.create({
      title: `Upcoming Week: ${nextMonday.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – ${getWeekSunday(nextMonday).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      weekStartDate: nextMonday,
      weekEndDate: getWeekSunday(nextMonday),
      selectionDeadline: nextDeadline,
      isPublished: true,
      status: 'published',
      days: buildDayMeals(nextMonday),
      isActive: true,
      createdBy: admin._id,
    });

    // Also create customer's active subscription so they can select meals right away!
    await Subscription.create({
      customer: customer._id,
      plan: plans[0]._id,
      startDate: currentMonday,
      endDate: new Date(currentMonday.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
      defaultDeliverySlot: slots[1]._id, // Lunch slot
    });

    console.log('[Seed] Current and Upcoming Weekly Menus & Customer Subscription created');

    console.log('\n======================================');
    console.log('✅ SEED COMPLETED SUCCESSFULLY');
    console.log('Admin Credentials: admin@puttumbeefum.com.au / Admin123!');
    console.log('Customer Credentials: andi@example.com.au / Customer123!');
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
