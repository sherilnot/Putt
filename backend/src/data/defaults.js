// Starter pickup windows, plans and dishes, shared by the dev seed, the production
// bootstrap and one-off data loads. The manager can change all of them later.

const DEFAULT_PICKUP_SLOTS = [
  { label: 'Morning (7:00 – 9:00 AM)', startTime: '07:00', endTime: '09:00', maxOrders: 100 },
  { label: 'Midday (12:00 – 2:00 PM)', startTime: '12:00', endTime: '14:00', maxOrders: 100 },
  { label: 'Evening (6:00 – 8:00 PM)', startTime: '18:00', endTime: '20:00', maxOrders: 100 },
];

const DEFAULT_PLANS = [
  {
    name: '1 Meal a Day (Weekly)',
    description: 'One freshly cooked Kerala meal every day, ready for pickup at your chosen time.',
    priceAUD: 65,
    intervalDays: 7,
    mealsPerDay: 1,
    dietTypes: ['veg', 'non-veg'],
  },
  {
    name: '2 Meals a Day (Weekly)',
    description: 'Two meals every day, collected together at your chosen pickup time.',
    priceAUD: 105,
    intervalDays: 7,
    mealsPerDay: 2,
    dietTypes: ['veg', 'non-veg'],
  },
  {
    name: '3 Meals a Day (Weekly)',
    description: 'Three meals every day, collected together at your chosen pickup time.',
    priceAUD: 140,
    intervalDays: 7,
    mealsPerDay: 3,
    dietTypes: ['veg', 'non-veg'],
  },
  {
    name: '3 Meals a Day (Monthly)',
    description: '30 days of three meals a day, at a better price than weekly.',
    priceAUD: 490,
    intervalDays: 30,
    mealsPerDay: 3,
    dietTypes: ['veg', 'non-veg'],
  },
];

const DEFAULT_FOOD_ITEMS = [
  { name: 'Rice and Chicken Curry', dietType: 'non-veg' },
  { name: 'Rice and Beef Curry', dietType: 'non-veg' },
  { name: 'Chicken Biriyani', dietType: 'non-veg' },
  { name: 'Chicken Kabsa', dietType: 'non-veg' },
  { name: 'Beef Biriyani', dietType: 'non-veg' },
  { name: 'Beef Kabsa', dietType: 'non-veg' },
  { name: 'Mutton Biriyani', dietType: 'non-veg' },
  { name: 'Mutton Kabsa', dietType: 'non-veg' },
  { name: 'Rice and Veg Curry', dietType: 'veg' },
  { name: 'Kappa and Beef', dietType: 'non-veg' },
  { name: 'Kappa and Fish Curry', dietType: 'non-veg' },
  { name: 'Puttu and Chickpeas Curry', dietType: 'veg' },
  { name: 'Puttu and Egg Curry', dietType: 'non-veg' },
  { name: 'Idiyappam and Chicken Curry', dietType: 'non-veg' },
  { name: 'Idiyappam and Chickpeas Curry', dietType: 'veg' },
];

module.exports = { DEFAULT_PICKUP_SLOTS, DEFAULT_PLANS, DEFAULT_FOOD_ITEMS };
