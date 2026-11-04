const mongoose = require('mongoose');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The dishes the manager offers on one day (up to 3; none means the kitchen is closed)
const menuDaySchema = new mongoose.Schema(
  {
    dayName: { type: String, enum: DAY_NAMES, required: true },
    date: { type: Date, required: true },
    dishes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' }],
  },
  { _id: false }
);

const weeklyMenuSchema = new mongoose.Schema(
  {
    weekStartDate: { type: Date, required: true, unique: true },
    days: [menuDaySchema],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WeeklyMenu', weeklyMenuSchema);
