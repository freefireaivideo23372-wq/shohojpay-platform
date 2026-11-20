import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { email, plan_name, amount, trx_id } = req.body || {};
  if (!email || !trx_id) return res.status(400).json({ status: false, message: 'ইমেইল এবং TrxID প্রয়োজন।' });

  const cleanTrx = trx_id.trim().toUpperCase();

  // Check if that TrxID actually arrived in sms_logs on the owner's phone with matching amount!
  const { data: sms } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('trx_id', cleanTrx)
    .eq('is_used', false)
    .maybeSingle();

  if (!sms) {
    return res.status(404).json({
      status: false,
      message: 'এই TrxID এখনো আমাদের ফোনে আসেনি। টাকা পাঠানোর ১০ সেকেন্ড পর আবার চেষ্টা করুন।'
    });
  }

  if (Number(sms.amount) < Number(amount)) {
    return res.status(400).json({
      status: false,
      message: `প্ল্যানের মূল্য ৳${amount}, কিন্তু পাওয়া গেছে ৳${sms.amount}।`
    });
  }

  await supabase.from('sms_logs').update({ is_used: true, matched_invoice_id: 'SUB_' + cleanTrx }).eq('id', sms.id);
  await supabase.from('merchants').update({ plan_name, plan_status: 'ACTIVE' }).eq('email', email.trim().toLowerCase());

  return res.status(200).json({
    status: true,
    message: `${plan_name} সাবস্ক্রিপশন সফলভাবে অ্যাক্টিভ হয়েছে!`
  });
}
