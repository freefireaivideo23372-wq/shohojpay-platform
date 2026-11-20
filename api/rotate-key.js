import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method Not Allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const currentKey = req.headers['shohojpay-api-key'];
  if (!currentKey) return res.status(401).json({ status: false, message: 'Unauthorized' });

  const { data: merchant } = await supabase.from('merchants').select('id, email, is_owner').eq('api_key', currentKey).maybeSingle();
  if (!merchant) return res.status(401).json({ status: false, message: 'Invalid current API key' });

  const prefix = merchant.is_owner ? 'sp_live_owner_' : 'sp_live_';
  const newKey = prefix + crypto.randomBytes(12).toString('hex');

  const { data: updated, error } = await supabase
    .from('merchants')
    .update({ api_key: newKey })
    .eq('id', merchant.id)
    .select('id, brand_name, email, api_key, plan_name, plan_status, is_owner, plan_expires_at')
    .single();

  if (error) return res.status(500).json({ status: false, message: error.message });
  return res.status(200).json({ status: true, api_key: newKey, merchant: updated });
}
