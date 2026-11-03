// Default delivery windows and plans, shared by the dev seed and the production bootstrap.

const DEFAULT_SLOTS = [
  {
    label: 'Breakfast (7:00 AM – 8:30 AM)',
    mealTime: 'breakfast',
    startTime: '07:00',
    endTime: '08:30',
    maxOrders: 50,
  },
  {
    label: 'Lunch (12:00 PM – 1:30 PM)',
    mealTime: 'lunch',
    startTime: '12:00',
    endTime: '13:30',
    maxOrders: 100,
  },
  {
    label: 'Dinner (6:30 PM – 8:00 PM)',
    mealTime: 'dinner',
    startTime: '18:30',
    endTime: '20:00',
    maxOrders: 100,
  },
];

const DEFAULT_PLANS = [
  {
    name: 'Weekly Full Mess (3 Meals/Day)',
    description: 'Breakfast, Lunch & Dinner 7 days a week. Authentic Kerala taste.',
    priceAUD: 140,
    intervalDays: 7,
    mealsPerDay: 3,
    dietTypes: ['veg', 'non-veg'],
  },
  {
    name: 'Weekly Lunch & Dinner',
    description: 'Lunch and Dinner Monday to Sunday. Fresh hot delivery.',
    priceAUD: 105,
    intervalDays: 7,
    mealsPerDay: 2,
    dietTypes: ['veg', 'non-veg', 'vegan'],
  },
  {
    name: 'Weekly Lunch Only',
    description: 'Daily hot lunch box delivered to your workplace or home.',
    priceAUD: 65,
    intervalDays: 7,
    mealsPerDay: 1,
    dietTypes: ['veg', 'non-veg', 'vegan'],
  },
  {
    name: 'Monthly Unlimited Feast',
    description: '30-day all-inclusive subscription with free weekend specials.',
    priceAUD: 490,
    intervalDays: 30,
    mealsPerDay: 3,
    dietTypes: ['veg', 'non-veg'],
  },
];

// Starter Kerala dishes; the manager can edit or delete them in the app.
const DEFAULT_FOOD_ITEMS = [
  {
    name: 'Puttu & Beef Roast',
    description: 'Steamed rice cake cylindrical cylinders served with slow-roasted spicy Kerala beef.',
    category: 'breakfast',
    dietType: 'non-veg',
    price: 16.5,
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop',
  },
  {
    name: 'Appam & Chicken Stew',
    description: 'Soft-centered fermented rice pancakes with fragrant coconut milk chicken stew.',
    category: 'breakfast',
    dietType: 'non-veg',
    price: 15.0,
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop',
  },
  {
    name: 'Idli, Sambar & Coconut Chutney',
    description: 'Steamed fluffy rice and lentil cakes with spiced vegetable stew and fresh coconut chutney.',
    category: 'breakfast',
    dietType: 'veg',
    price: 12.0,
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop',
  },
  {
    name: 'Traditional Kerala Meals (Fish Curry)',
    description: 'Red Matta rice served with spicy Alleppey fish curry, thoran, avial, sambar, and pickle.',
    category: 'lunch',
    dietType: 'non-veg',
    price: 18.5,
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop',
  },
  {
    name: 'Kerala Veg Sadhya Lunch',
    description: 'Steamed rice, parippu, sambar, avial, thoran, moru curry, papadam, and payasam.',
    category: 'lunch',
    dietType: 'veg',
    price: 16.0,
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop',
  },
  {
    name: 'Malabar Chicken Dum Biryani',
    description: 'Khaima rice cooked on dum with tender chicken, ghee, fried onions, and sultanas.',
    category: 'lunch',
    dietType: 'non-veg',
    price: 19.0,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop',
  },
  {
    name: 'Malabar Parotta & Beef Curry',
    description: 'Flaky layered Kerala parotta served with aromatic rich beef gravy.',
    category: 'dinner',
    dietType: 'non-veg',
    price: 17.5,
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop',
  },
  {
    name: 'Chapati & Paneer Butter Masala',
    description: 'Whole wheat flatbreads with rich cottage cheese in tomato cashew cream gravy.',
    category: 'dinner',
    dietType: 'veg',
    price: 15.5,
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop',
  },
  {
    name: 'Ghee Rice & Mutton Kurma',
    description: 'Aromatic short-grain rice sautéed in pure ghee served with succulent goat kurma.',
    category: 'dinner',
    dietType: 'non-veg',
    price: 21.0,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop',
  },
];

module.exports = { DEFAULT_SLOTS, DEFAULT_PLANS, DEFAULT_FOOD_ITEMS };
