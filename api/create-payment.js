import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method Not Allowed' });

  const apiKey = req.headers['shohojpay-api-key'] || req.body?.api_key;
  if (!apiKey || apiKey !== (process.env.MERCHANT_API_KEY || 'sp_live_98a72b41c65d89e01f23a45b')) {
    return res.status(401).json({ status: false, message: 'Unauthorized API Key' });
  }

  const { amount, order_id, customer_name, webhook_url, redirect_url } = req.body || {};
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ status: false, message: 'Valid amount is required' });
  }

  const invoiceId = 'INV_' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from('invoices')
    .insert([{
      invoice_id: invoiceId,
      order_id: order_id || invoiceId,
      amount: parseFloat(amount),
      customer_name: customer_name || 'Customer',
      customer_webhook_url: webhook_url || '',
      customer_redirect_url: redirect_url || '',
      status: 'PENDING'
    }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ status: false, message: error.message });
  }

  const host = req.headers.host ? `https://${req.headers.host}` : 'https://your-project.vercel.app';
  return res.status(200).json({
    status: true,
    invoice_id: invoiceId,
    payment_url: `${host}/?invoice=${invoiceId}&amount=${amount}`,
    data
  });
}
