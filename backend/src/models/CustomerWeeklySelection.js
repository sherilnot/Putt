const mongoose = require('mongoose');

const dailyChoiceSchema = new mongoose.Schema(
  {
    dayName: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    // Up to the plan's meals per day; the same dish may appear more than once
    meals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodItem',
      },
    ],
    pickupSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PickupSlot',
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
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    weekEndDate: {
      type: Date,
      required: true,
    },
    days: [dailyChoiceSchema],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// One selection per customer per week
customerWeeklySelectionSchema.index({ customer: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('CustomerWeeklySelection', customerWeeklySelectionSchema);
