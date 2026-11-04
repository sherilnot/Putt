const mongoose = require('mongoose');

// One dish on a customer's day, with the price it was billed at
const lineSchema = new mongoose.Schema(
  {
    foodItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
    quantity: { type: Number, min: 1, max: 3, required: true },
    price: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

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
    // Up to 3 meals in total, from that day's menu
    items: [lineSchema],
    pickupSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PickupSlot',
      default: null,
    },
  },
  { _id: false }
);

// A customer's week of meals, which is also their bill for that week
const customerWeeklySelectionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    totalAUD: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Paid offline; the manager records it
    payment: {
      status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
      method: { type: String, enum: ['cash', 'bank_transfer', 'payid', 'other'] },
      reference: { type: String, default: '' },
      paidAt: Date,
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

// One selection per customer per week
customerWeeklySelectionSchema.index({ customer: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('CustomerWeeklySelection', customerWeeklySelectionSchema);
