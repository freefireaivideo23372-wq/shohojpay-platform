import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const validPins = [process.env.ADMIN_PASSWORD || 'sayba123?', 'sayba123?', 'admin123456'];
  const providedPin = req.headers['x-admin-pin'] || req.body?.admin_pin || '';

  if (!validPins.includes(providedPin)) {
    return res.status(401).json({ status: false, message: 'ভুল অ্যাডমিন পাসওয়ার্ড!' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const [{ data: settings }, { data: merchants }, { data: smsLogs }, { data: websites }] = await Promise.all([
      supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('merchants').select('id, brand_name, email, api_key, plan_name, plan_status, plan_expires_at, is_owner, created_at').order('created_at', { ascending: false }),
      supabase.from('sms_logs').select('*').order('received_at', { ascending: false }).limit(50),
      supabase.from('merchant_websites').select('*').order('created_at', { ascending: false })
    ]);
    return res.status(200).json({ status: true, settings: settings || {}, merchants: merchants || [], sms_logs: smsLogs || [], websites: websites || [] });
  }

  const { action } = req.body || {};
  if (action === 'update_settings') {
    const s = req.body.settings || {};
    const { data, error } = await supabase.from('site_settings').upsert([{
      id: 1,
      brand_name_en: s.brand_name_en,
      brand_name_bn: s.brand_name_bn,
      hero_title: s.hero_title,
      support_phone: s.support_phone,
      apk_download_url: s.apk_download_url,
      owner_bkash: s.owner_bkash,
      owner_nagad: s.owner_nagad,
      owner_rocket: s.owner_rocket,
      price_starter_month: Number(s.price_starter_month || 49),
      price_starter_year: Number(s.price_starter_year || 399),
      price_pro_month: Number(s.price_pro_month || 99),
      price_pro_year: Number(s.price_pro_year || 799),
      price_lifetime: Number(s.price_lifetime || 1499),
      updated_at: new Date().toISOString()
    }]).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, message: 'ওয়েবসাইটের সব সেটিংস সফলভাবে আপডেট হয়েছে!', settings: data });
  }

  if (action === 'update_merchant') {
    const { email, plan_name, plan_status, is_owner, days } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const expiresAt = days ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;

    const { error } = await supabase.from('merchants').update({
      plan_name: plan_name || 'Owner Lifetime Unlimited',
      plan_status: plan_status || 'ACTIVE',
      is_owner: Boolean(is_owner),
      plan_expires_at: expiresAt
    }).eq('email', cleanEmail);

    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, message: `${cleanEmail} আপডেট হয়েছে!` });
  }

  return res.status(400).json({ status: false, message: 'Invalid action' });
}
