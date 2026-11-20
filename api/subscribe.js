import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { email, plan_name, duration, trx_id } = req.body || {};
  if (!email || !trx_id) return res.status(400).json({ status: false, message: 'ইমেইল এবং TrxID দিন।' });

  const { data: settings } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  const s = settings || {};

  // Calculate required exact price from live site_settings
  let requiredAmount = 99;
  let durationDays = 30;
  let fullPlanLabel = plan_name;

  if (plan_name === 'Starter' && duration === '1_year') {
    requiredAmount = Number(s.price_starter_year || 399);
    durationDays = 365;
    fullPlanLabel = 'Starter (1 Year)';
  } else if (plan_name === 'Starter') {
    requiredAmount = Number(s.price_starter_month || 49);
    durationDays = 30;
    fullPlanLabel = 'Starter (1 Month)';
  } else if (plan_name === 'Business Pro' && duration === '1_year') {
    requiredAmount = Number(s.price_pro_year || 799);
    durationDays = 365;
    fullPlanLabel = 'Business Pro (1 Year)';
  } else if (plan_name === 'Business Pro') {
    requiredAmount = Number(s.price_pro_month || 99);
    durationDays = 30;
    fullPlanLabel = 'Business Pro (1 Month)';
  } else if (plan_name === 'Lifetime') {
    requiredAmount = Number(s.price_lifetime || 1499);
    durationDays = 36500; // 100 years
    fullPlanLabel = 'Lifetime Unlimited';
  }

  const cleanTrx = trx_id.trim().toUpperCase();
  const { data: sms } = await supabase.from('sms_logs').select('*').eq('trx_id', cleanTrx).eq('is_used', false).maybeSingle();

  if (!sms) {
    return res.status(404).json({
      status: false,
      message: 'এই TrxID এখনো আমাদের ফোনে আসেনি। টাকা পাঠানোর ১০ সেকেন্ড পর আবার চেষ্টা করুন।'
    });
  }

  if (Number(sms.amount) < requiredAmount) {
    return res.status(400).json({
      status: false,
      message: `${fullPlanLabel}-এর মূল্য ৳${requiredAmount}, কিন্তু পাওয়া গেছে ৳${sms.amount}।`
    });
  }

  const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();

  await supabase.from('sms_logs').update({ is_used: true, matched_invoice_id: 'SUB_' + cleanTrx }).eq('id', sms.id);
  await supabase.from('merchants').update({
    plan_name: fullPlanLabel,
    plan_status: 'ACTIVE',
    plan_expires_at: expiresAt
  }).eq('email', email.trim().toLowerCase());

  return res.status(200).json({
    status: true,
    message: `অভিনন্দন! আপনার ${fullPlanLabel} সাবস্ক্রিপশন অটো-ভেরিফাই হয়ে অ্যাক্টিভ হয়েছে!`
  });
}
