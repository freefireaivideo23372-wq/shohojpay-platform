import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
