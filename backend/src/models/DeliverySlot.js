const mongoose = require('mongoose');

const deliverySlotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Slot label is required (e.g. 7–9 AM)'],
      trim: true,
    },
    mealTime: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      default: 'lunch',
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (HH:mm)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (HH:mm)'],
      trim: true,
    },
    maxOrders: {
      type: Number,
      default: 50,
      min: 1,
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

module.exports = mongoose.model('DeliverySlot', deliverySlotSchema);
