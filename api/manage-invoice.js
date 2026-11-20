import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = req.headers['shohojpay-api-key'];
  const { data: merchant } = await supabase.from('merchants').select('id').eq('api_key', apiKey).maybeSingle();
  if (!merchant) return res.status(401).json({ status: false, message: 'Unauthorized' });

  const { id, action } = req.body || {};
  if (!id) return res.status(400).json({ status: false, message: 'Invoice ID required' });

  if (action === 'approve') {
    const { data, error } = await supabase.from('invoices').update({ status: 'APPROVED', approved_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, invoice: data });
  }
  if (action === 'delete') {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true });
  }
  return res.status(400).json({ status: false, message: 'Invalid action' });
}
