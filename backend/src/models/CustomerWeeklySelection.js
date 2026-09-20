const mongoose = require('mongoose');

const dailyMealChoiceSchema = new mongoose.Schema(
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
      required: true,
    },
    breakfast: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      default: null,
    },
    lunch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      default: null,
    },
    dinner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      default: null,
    },
    deliverySlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliverySlot',
      default: null,
    },
  },
  { _id: false }
);

const customerWeeklySelectionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    weeklyMenu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyMenu',
      required: true,
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    weekEndDate: {
      type: Date,
      required: true,
    },
    selections: [dailyMealChoiceSchema],
    isLocked: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one selection per customer per week
customerWeeklySelectionSchema.index(
  { customer: 1, weekStartDate: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  'CustomerWeeklySelection',
  customerWeeklySelectionSchema
);
