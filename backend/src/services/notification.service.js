const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send push notification to a single device
 */
const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) {
    console.warn(`[Notification] Invalid or missing Expo push token: ${expoPushToken}`);
    return null;
  }

  const messages = [
    {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    },
  ];

  try {
    const ticketChunk = await expo.sendPushNotificationsAsync(messages);
    return ticketChunk;
  } catch (error) {
    console.error('[Notification] Error sending push notification:', error);
    return null;
  }
};

/**
 * Notify customer about order status change
 */
const notifyOrderStatusChange = async (user, orderStatus, foodItemName) => {
  if (!user.expoPushToken) return;

  const statusMessages = {
    preparing: `Your meal "${foodItemName}" is now being prepared! 🍳`,
    out_for_delivery: `Your order "${foodItemName}" is out for delivery! 🛵`,
    delivered: `Your delicious meal "${foodItemName}" has been delivered! Enjoy your meal 🍽️`,
    cancelled: `Your order for "${foodItemName}" has been cancelled.`,
  };

  const body = statusMessages[orderStatus] || `Your order status changed to ${orderStatus}.`;
  await sendPushNotification(user.expoPushToken, 'Puttum Beefum Update', body, {
    type: 'ORDER_STATUS',
    status: orderStatus,
  });
};

module.exports = {
  sendPushNotification,
  notifyOrderStatusChange,
};
