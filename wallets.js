import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = req.headers['shohojpay-api-key'];
  if (!apiKey) return res.status(401).json({ status: false, message: 'Unauthorized' });

  const { data: merchant } = await supabase.from('merchants').select('id').eq('api_key', apiKey).maybeSingle();
  if (!merchant) return res.status(401).json({ status: false, message: 'Invalid API Key' });

  if (req.method === 'POST') {
    const { gateway, phone_number, account_type } = req.body || {};
    const { data, error } = await supabase.from('wallets').insert([{
      gateway,
      phone_number,
      account_type: account_type || 'Personal (Send Money)',
      is_active: true
    }]).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, wallet: data });
  }

  const { data: wallets } = await supabase.from('wallets').select('*').order('created_at', { ascending: false });
  return res.status(200).json({ status: true, wallets: wallets || [] });
}
