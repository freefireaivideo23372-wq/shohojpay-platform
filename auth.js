import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + '_shohojpay_salt_2026').digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method Not Allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { action, email, password, brand_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ status: false, message: 'ইমেইল ও পাসওয়ার্ড দিন।' });

  const cleanEmail = email.trim().toLowerCase();
  const pwHash = hashPassword(password);

  if (action === 'register') {
    const { data: existing } = await supabase.from('merchants').select('id').eq('email', cleanEmail).maybeSingle();
    if (existing) return res.status(409).json({ status: false, message: 'এই ইমেইল দিয়ে আগেই একাউন্ট খোলা আছে।' });

    const newApiKey = 'sp_live_' + crypto.randomBytes(12).toString('hex');
    const { data, error } = await supabase.from('merchants').insert([{
      brand_name: brand_name || 'My Shop',
      email: cleanEmail,
      password_hash: pwHash,
      api_key: newApiKey,
      plan_name: 'None',
      plan_status: 'INACTIVE' // Locked until they actually buy a subscription!
    }]).select('id, brand_name, email, api_key, plan_name, plan_status').single();

    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, merchant: data });
  }

  // Login
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, brand_name, email, api_key, plan_name, plan_status, password_hash')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (!merchant || (merchant.password_hash && merchant.password_hash !== pwHash)) {
    return res.status(401).json({ status: false, message: 'ইমেইল অথবা পাসওয়ার্ড ভুল হয়েছে।' });
  }

  delete merchant.password_hash;
  return res.status(200).json({ status: true, merchant });
}
