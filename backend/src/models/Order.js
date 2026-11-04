const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    // 1st, 2nd or 3rd meal of the customer's day (up to 3 a day)
    mealNumber: {
      type: Number,
      min: 1,
      max: 3,
      required: true,
    },
    foodItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodItem',
      required: true,
    },
    pickupSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PickupSlot',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'collected', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
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

module.exports = mongoose.model('Order', orderSchema);
