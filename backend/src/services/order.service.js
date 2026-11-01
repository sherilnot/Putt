const Order = require('../models/Order');

/**
 * Cancel a subscription's not-yet-started orders so the kitchen stops seeing them
 * once the subscription is paused, cancelled or expired.
 */
const cancelFuturePendingOrders = async (subscriptionId) => {
  const startOfTomorrow = new Date();
  startOfTomorrow.setHours(0, 0, 0, 0);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const result = await Order.updateMany(
    { subscription: subscriptionId, status: 'pending', date: { $gte: startOfTomorrow } },
    { status: 'cancelled' }
  );
  return result.modifiedCount;
};

module.exports = { cancelFuturePendingOrders };
