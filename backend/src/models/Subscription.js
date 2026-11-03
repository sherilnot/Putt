const mongoose = require('mongoose');

// A payment received offline (cash, bank transfer, PayID) and confirmed by the manager
const paymentSchema = new mongoose.Schema(
  {
    amountAUD: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'payid', 'other'],
      required: true,
    },
    reference: { type: String, trim: true, default: '' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    confirmedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      // 'pending' = requested by the customer, awaiting the manager's payment confirmation
      enum: ['pending', 'active', 'paused', 'cancelled', 'expired'],
      default: 'pending',
    },
    payments: [paymentSchema],
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

module.exports = mongoose.model('Subscription', subscriptionSchema);
