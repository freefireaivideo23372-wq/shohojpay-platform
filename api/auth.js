import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + '_shohojpay_salt_2026').digest('hex');
}

const OWNER_EMAIL = 'khadizashuvo50@gmail.com';
const OWNER_PASS = 'sayba123?';

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

  // Special Guaranteed Owner Login (Auto-creates/activates if not yet in DB!)
  if (cleanEmail === OWNER_EMAIL && password === OWNER_PASS) {
    const ownerApiKey = 'sp_live_owner_98a72b41c65d89e01f23a45b';
    const { data: upserted } = await supabase.from('merchants').upsert([{
      brand_name: 'ShohojPay Official',
      email: OWNER_EMAIL,
      password_hash: pwHash,
      api_key: ownerApiKey,
      plan_name: 'Owner Lifetime Unlimited',
      plan_status: 'ACTIVE',
      is_owner: true,
      plan_expires_at: '2099-12-31T23:59:59Z'
    }], { onConflict: 'email' }).select('id, brand_name, email, api_key, plan_name, plan_status, is_owner, plan_expires_at').single();

    return res.status(200).json({
      status: true,
      merchant: upserted || {
        brand_name: 'ShohojPay Official',
        email: OWNER_EMAIL,
        api_key: ownerApiKey,
        plan_name: 'Owner Lifetime Unlimited',
        plan_status: 'ACTIVE',
        is_owner: true
      }
    });
  }

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
      plan_status: 'INACTIVE',
      is_owner: false
    }]).select('id, brand_name, email, api_key, plan_name, plan_status, is_owner').single();

    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, merchant: data });
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, brand_name, email, api_key, plan_name, plan_status, is_owner, plan_expires_at, password_hash')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (!merchant || (merchant.password_hash && merchant.password_hash !== pwHash)) {
    return res.status(401).json({ status: false, message: 'ইমেইল অথবা পাসওয়ার্ড ভুল হয়েছে।' });
  }

  delete merchant.password_hash;
  return res.status(200).json({ status: true, merchant });
}
