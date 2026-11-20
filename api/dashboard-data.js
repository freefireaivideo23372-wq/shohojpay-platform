import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ status: false, message: 'Supabase env vars not set yet' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const [{ data: invoices }, { data: wallets }, { data: smsLogs }] = await Promise.all([
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('wallets').select('*').order('created_at', { ascending: true }),
    supabase.from('sms_logs').select('*').order('received_at', { ascending: false }).limit(50)
  ]);

  return res.status(200).json({
    status: true,
    invoices: invoices || [],
    wallets: wallets || [],
    sms_logs: smsLogs || []
  });
}
