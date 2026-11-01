const Stripe = require('stripe');

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[Stripe] Warning: STRIPE_SECRET_KEY is not set. Mock mode active.');
    return null;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
};

const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Verify and parse a webhook payload. Throws if the signature is invalid.
 */
const constructWebhookEvent = (rawBody, signature) => {
  const stripe = getStripeClient();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook is not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
};

/**
 * Create or retrieve customer in Stripe
 */
const createStripeCustomer = async (user) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return `cus_mock_${user._id}`;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    phone: user.phone || undefined,
    metadata: {
      userId: user._id.toString(),
    },
  });

  return customer.id;
};

/**
 * Create payment intent or checkout session for a subscription
 */
const createSubscriptionSession = async (user, plan, successUrl, cancelUrl) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      id: `sub_mock_${Date.now()}`,
      url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/success?mock=true`,
    };
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(user);
    user.stripeCustomerId = customerId;
    await user.save();
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'aud',
          product_data: {
            name: plan.name,
            description: plan.description || `Puttum Beefum ${plan.name} meal plan`,
          },
          unit_amount: Math.round(plan.priceAUD * 100), // cents
          recurring: {
            interval: plan.intervalDays === 30 ? 'month' : 'week',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user._id.toString(),
      planId: plan._id.toString(),
    },
  });

  return session;
};

/**
 * Cancel a subscription in Stripe
 */
const cancelStripeSubscription = async (stripeSubscriptionId) => {
  const stripe = getStripeClient();
  // Only real Stripe subscription ids (sub_...) can be cancelled; mock ids are skipped
  if (!stripe || !stripeSubscriptionId.startsWith('sub_') || stripeSubscriptionId.startsWith('sub_mock_')) {
    return { status: 'cancelled' };
  }

  return await stripe.subscriptions.cancel(stripeSubscriptionId);
};

module.exports = {
  isStripeConfigured,
  constructWebhookEvent,
  createStripeCustomer,
  createSubscriptionSession,
  cancelStripeSubscription,
};
