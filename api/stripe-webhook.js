import {
  isActiveSubscriptionStatus,
  saveProfileForUser,
  stripe,
  updateProfileForCustomer
} from './_stripe-helpers.js';

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function handleCheckoutCompleted(session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const userId = session.metadata?.user_id;

  if (!customerId || !userId) return;

  const values = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId || null,
    is_pro: true
  };

  await saveProfileForUser(userId, values);
}

async function handleSubscriptionChange(subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  await updateProfileForCustomer(customerId, {
    stripe_subscription_id: subscription.id,
    is_pro: isActiveSubscriptionStatus(subscription.status)
  });
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  await updateProfileForCustomer(customerId, {
    stripe_subscription_id: subscription.id,
    is_pro: false
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await handleSubscriptionChange(event.data.object);
    }

    if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
