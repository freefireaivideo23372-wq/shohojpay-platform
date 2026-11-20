import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // POST Actions: rotate_key, approve_invoice, delete_invoice
  if (req.method === 'POST') {
    const apiKey = req.headers['shohojpay-api-key'];
    if (!apiKey) return res.status(401).json({ status: false, message: 'Unauthorized' });

    const { data: merchant } = await supabase.from('merchants').select('id, email, is_owner').eq('api_key', apiKey).maybeSingle();
    if (!merchant) return res.status(401).json({ status: false, message: 'Invalid API Key' });

    const { action, id } = req.body || {};

    if (action === 'rotate_key') {
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

    if (action === 'approve_invoice' && id) {
      const { data, error } = await supabase.from('invoices').update({ status: 'APPROVED', approved_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) return res.status(500).json({ status: false, message: error.message });
      return res.status(200).json({ status: true, invoice: data });
    }

    if (action === 'delete_invoice' && id) {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) return res.status(500).json({ status: false, message: error.message });
      return res.status(200).json({ status: true });
    }

    return res.status(400).json({ status: false, message: 'Invalid action' });
  }

  // GET Dashboard Data
  const email = (req.query?.email || '').trim().toLowerCase();
  let merchant = null;
  let websites = [];
  if (email) {
    const { data } = await supabase
      .from('merchants')
      .select('id, brand_name, email, api_key, plan_name, plan_status, plan_expires_at, is_owner')
      .eq('email', email)
      .maybeSingle();
    merchant = data;

    const { data: ws } = await supabase
      .from('merchant_websites')
      .select('*')
      .eq('merchant_email', email)
      .order('created_at', { ascending: false });
    websites = ws || [];
  }

  const [{ data: invoices }, { data: wallets }, { data: smsLogs }, { data: settings }] = await Promise.all([
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('wallets').select('*').order('created_at', { ascending: false }),
    supabase.from('sms_logs').select('*').order('received_at', { ascending: false }).limit(50),
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  ]);

  return res.status(200).json({
    status: true,
    merchant,
    websites,
    settings: settings || {},
    invoices: invoices || [],
    wallets: wallets || [],
    sms_logs: smsLogs || []
  });
}
