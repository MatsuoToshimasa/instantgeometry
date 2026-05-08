import {
  getAuthenticatedUser,
  getBaseUrl,
  getOrCreateStripeCustomer,
  stripe,
  supabaseAdmin
} from './_stripe-helpers.js';

async function getSetting(key) {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) throw error;
  return data.value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    const priceId = await getSetting('stripe_price_id');
    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${baseUrl}/upgrade/success/`,
      cancel_url: `${baseUrl}/upgrade/`,
      metadata: {
        user_id: user.id
      },
      subscription_data: {
        metadata: {
          user_id: user.id
        }
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}
