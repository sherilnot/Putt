const mongoose = require('mongoose');

const mealSlotSchema = new mongoose.Schema(
  {
    mealTime: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    foodItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodItem',
      },
    ],
  },
  { _id: false }
);

const dayMenuSchema = new mongoose.Schema(
  {
    dayName: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      required: true,
    },
    date: {
      type: Date,
      required: false,
    },
    meals: [mealSlotSchema],
  },
  { _id: false }
);

const weeklyMenuSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Weekly Menu',
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    weekEndDate: {
      type: Date,
      required: false,
    },
    selectionDeadline: {
      type: Date,
      required: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
    },
    days: [dayMenuSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WeeklyMenu', weeklyMenuSchema);
