import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover'
});

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function getBaseUrl() {
  return (process.env.SITE_URL || 'https://instantgeometry.com').replace(/\/$/, '');
}

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

export async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('ログイン状態を確認できませんでした。もう一度ログインしてください。');
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error('ログイン状態を確認できませんでした。もう一度ログインしてください。');
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}

async function findCustomerByEmail(email) {
  if (!email) return '';
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0]?.id || '';
}

export async function getOrCreateStripeCustomer(user) {
  const userId = user.id;
  const email = user.email || '';

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const existingCustomerId = await findCustomerByEmail(email);
  if (existingCustomerId) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ user_id: userId, stripe_customer_id: existingCustomerId }, { onConflict: 'user_id' });
    if (error) throw error;
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId
    }
  });

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: 'user_id' });
  if (error) throw error;

  return customer.id;
}

export async function updateProfileForCustomer(customerId, values) {
  if (!customerId) return;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(values)
    .eq('stripe_customer_id', customerId);
  if (error) throw error;
}

export function isActiveSubscriptionStatus(status) {
  return ['active', 'trialing'].includes(status);
}
