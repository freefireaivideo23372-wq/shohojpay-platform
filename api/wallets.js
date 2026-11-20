import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = req.headers['shohojpay-api-key'];
  if (!apiKey) return res.status(401).json({ status: false, message: 'Unauthorized' });

  const { data: merchant } = await supabase.from('merchants').select('id').eq('api_key', apiKey).maybeSingle();
  if (!merchant) return res.status(401).json({ status: false, message: 'Invalid API Key' });

  // CREATE Wallet
  if (req.method === 'POST') {
    const { gateway, phone_number, account_type } = req.body || {};
    if (!gateway || !phone_number) return res.status(400).json({ status: false, message: 'Gateway and phone required' });
    const { data, error } = await supabase.from('wallets').insert([{
      gateway,
      phone_number: phone_number.trim(),
      account_type: account_type || 'Personal (Send Money)',
      is_active: true
    }]).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, wallet: data });
  }

  // UPDATE / EDIT / TOGGLE Wallet
  if (req.method === 'PATCH') {
    const { id, gateway, phone_number, account_type, is_active } = req.body || {};
    if (!id) return res.status(400).json({ status: false, message: 'Wallet ID required' });
    const updates = {};
    if (gateway !== undefined) updates.gateway = gateway;
    if (phone_number !== undefined) updates.phone_number = phone_number.trim();
    if (account_type !== undefined) updates.account_type = account_type;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const { data, error } = await supabase.from('wallets').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, wallet: data });
  }

  // DELETE Wallet
  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ status: false, message: 'Wallet ID required' });
    const { error } = await supabase.from('wallets').delete().eq('id', id);
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, deleted: id });
  }

  const { data: wallets } = await supabase.from('wallets').select('*').order('created_at', { ascending: false });
  return res.status(200).json({ status: true, wallets: wallets || [] });
}
