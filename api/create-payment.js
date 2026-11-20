import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = req.headers['shohojpay-api-key'] || req.body?.api_key;

  let authorized = false;
  let defaultWebhook = '';

  const { data: merchant } = await supabase.from('merchants').select('*').eq('api_key', apiKey).maybeSingle();
  if (merchant && (merchant.plan_status === 'ACTIVE' || merchant.is_owner)) {
    authorized = true;
  } else {
    const { data: site } = await supabase.from('merchant_websites').select('*').eq('site_api_key', apiKey).eq('is_active', true).maybeSingle();
    if (site) {
      authorized = true;
      defaultWebhook = site.webhook_url || '';
    }
  }

  if (!authorized) {
    return res.status(401).json({ status: false, message: 'Active subscription & valid API key required' });
  }

  const { amount, order_id, customer_name, webhook_url, redirect_url, cancel_url } = req.body || {};
  if (!amount || Number(amount) <= 0) return res.status(400).json({ status: false, message: 'Valid amount required' });

  const invoiceId = 'INV_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase.from('invoices').insert([{
    invoice_id: invoiceId,
    order_id: order_id || invoiceId,
    amount: parseFloat(amount),
    customer_name: customer_name || 'Customer',
    customer_webhook_url: webhook_url || defaultWebhook,
    customer_redirect_url: redirect_url || '',
    status: 'PENDING'
  }]).select().single();

  if (error) return res.status(500).json({ status: false, message: error.message });
  const host = req.headers.host ? `https://${req.headers.host}` : 'https://shohojpay-platform.vercel.app';
  const cancelParam = cancel_url ? `&cancel_url=${encodeURIComponent(cancel_url)}` : '';
  return res.status(200).json({
    status: true,
    invoice_id: invoiceId,
    payment_url: `${host}/pay?invoice=${invoiceId}&amount=${amount}${cancelParam}`,
    data
  });
}
