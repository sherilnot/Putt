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

module.exports = { DEFAULT_SLOTS, DEFAULT_PLANS };
