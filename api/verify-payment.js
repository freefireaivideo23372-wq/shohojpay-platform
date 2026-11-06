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

  const { invoice_id, trx_id } = req.body || {};
  if (!invoice_id) return res.status(400).json({ status: false, message: 'invoice_id required' });

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_id', invoice_id)
    .maybeSingle();

  if (!invoice) return res.status(404).json({ status: false, message: 'Invoice not found' });
  if (invoice.status === 'APPROVED') {
    return res.status(200).json({ status: true, payment_status: 'APPROVED', invoice });
  }

  if (trx_id) {
    const cleanTrx = trx_id.trim().toUpperCase();
    const { data: sms } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('trx_id', cleanTrx)
      .eq('is_used', false)
      .maybeSingle();

    if (!sms) {
      return res.status(404).json({ status: false, payment_status: 'PENDING', message: 'TrxID not received on phone yet' });
    }
    if (Number(sms.amount) !== Number(invoice.amount)) {
      return res.status(400).json({ status: false, payment_status: 'AMOUNT_MISMATCH', message: `Expected ${invoice.amount}, got ${sms.amount}` });
    }

    await supabase.from('sms_logs').update({ is_used: true, matched_invoice_id: invoice_id }).eq('id', sms.id);
    const { data: updatedInv } = await supabase
      .from('invoices')
      .update({
        status: 'APPROVED',
        gateway: sms.gateway,
        payment_type: sms.payment_type,
        sender_phone: sms.sender_phone,
        trx_id: cleanTrx,
        approved_at: new Date().toISOString()
      })
      .eq('id', invoice.id)
      .select()
      .single();

    return res.status(200).json({ status: true, payment_status: 'APPROVED', invoice: updatedInv });
  }

  return res.status(200).json({ status: false, payment_status: 'PENDING' });
}
