import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { invoice_id, trx_id } = req.body || {};
  if (!invoice_id) return res.status(400).json({ status: false, message: 'invoice_id required' });

  const [{ data: invoice }, { data: wallets }] = await Promise.all([
    supabase.from('invoices').select('*').eq('invoice_id', invoice_id).maybeSingle(),
    supabase.from('wallets').select('*').eq('is_active', true)
  ]);

  if (!invoice) return res.status(404).json({ status: false, message: 'Invoice not found' });
  if (invoice.status === 'APPROVED') return res.status(200).json({ status: true, payment_status: 'APPROVED', invoice, wallets });

  if (trx_id) {
    const cleanTrx = trx_id.trim().toUpperCase();
    const { data: sms } = await supabase.from('sms_logs').select('*').eq('trx_id', cleanTrx).eq('is_used', false).maybeSingle();
    if (!sms) return res.status(404).json({ status: false, payment_status: 'PENDING', message: 'TrxID এখনো ফোনে আসেনি।', wallets });
    if (Number(sms.amount) !== Number(invoice.amount)) return res.status(400).json({ status: false, payment_status: 'AMOUNT_MISMATCH', message: `টাকার পরিমাণ মেলেনি।`, wallets });

    await supabase.from('sms_logs').update({ is_used: true, matched_invoice_id: invoice_id }).eq('id', sms.id);
    const { data: updated } = await supabase.from('invoices').update({
      status: 'APPROVED', gateway: sms.gateway, payment_type: sms.payment_type,
      sender_phone: sms.sender_phone, trx_id: cleanTrx, approved_at: new Date().toISOString()
    }).eq('id', invoice.id).select().single();

    return res.status(200).json({ status: true, payment_status: 'APPROVED', invoice: updated, wallets });
  }

  return res.status(200).json({ status: false, payment_status: 'PENDING', invoice, wallets });
}
