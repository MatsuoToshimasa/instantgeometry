import { getAuthenticatedUser, getBaseUrl, getOrCreateStripeCustomer, stripe } from './_stripe-helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);
    const baseUrl = getBaseUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account/`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}
