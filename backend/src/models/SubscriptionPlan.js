const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required (e.g. Weekly Full Mess, Monthly Lunch Only)'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    priceAUD: {
      type: Number,
      required: [true, 'Price in AUD is required'],
      min: 0,
    },
    intervalDays: {
      type: Number,
      enum: [7, 14, 30],
      default: 7, // 7 for weekly, 30 for monthly
    },
    mealsPerDay: {
      type: Number,
      required: true,
      default: 1, // e.g. 1 meal/day, 2 meals/day, 3 meals/day
    },
    dietTypes: [
      {
        type: String,
        enum: ['veg', 'non-veg', 'vegan'],
      },
    ],
    stripeProductId: {
      type: String,
      default: '',
    },
    stripePriceId: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
