const mongoose = require('mongoose');

// A time window in which customers collect their meals from the mess
const pickupSlotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Label is required (e.g. Midday (12:00 – 2:00 PM))'],
      trim: true,
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
      default: 100,
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

module.exports = mongoose.model('PickupSlot', pickupSlotSchema);
