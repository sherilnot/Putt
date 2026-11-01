const Subscription = require('../models/Subscription');
const { constructWebhookEvent } = require('../services/stripe.service');
const { cancelFuturePendingOrders } = require('../services/order.service');

// @desc    Stripe webhook: the only place a paid subscription becomes active
// @route   POST /api/stripe/webhook
// @access  Stripe (signature verified)
const handleStripeWebhook = async (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.warn(`[Stripe Webhook] Rejected: ${err.message}`);
    return res.status(400).json({ received: false, message: 'Invalid webhook signature' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.payment_status === 'paid' || session.status === 'complete') {
        await Subscription.findOneAndUpdate(
          { stripeCheckoutSessionId: session.id, status: 'pending' },
          { status: 'active', stripeSubscriptionId: session.subscription || '' }
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object;
      const subscription = await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSub.id },
        { status: 'cancelled' },
        { new: true }
      );
      if (subscription) await cancelFuturePendingOrders(subscription._id);
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
};

module.exports = { handleStripeWebhook };
