import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  try {
    const amount = await getSetting('pro_monthly_yen');
    const planName = await getSetting('pro_plan_name');

    return res.status(200).json({
      amount,
      planName
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}