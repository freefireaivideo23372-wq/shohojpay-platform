import { createClient } from '@supabase/supabase-js';

function parseMfsSms(sender = '', message = '') {
  const text = message.trim();
  const bkMatch = text.match(/(received|Cash Out|Cash In|Payment)\s+Tk\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+(01\d{9}).*?TrxID\s+([A-Z0-9]+)/i);
  if (bkMatch) return { gateway: 'bKash', payment_type: /Cash Out/i.test(bkMatch[1]) ? 'CASH_OUT' : 'SEND_MONEY', amount: parseFloat(bkMatch[2].replace(/,/g, '')), sender_phone: bkMatch[3], trx_id: bkMatch[4].toUpperCase() };

  const ngMatch = text.match(/(Money Received|Cash Out|Cash-Out).*?Amount:\s*Tk\s*([\d,]+(?:\.\d{1,2})?).*?(?:Sender|Customer|From):\s*(01\d{9}).*?(?:TxnID|TrxID):\s*([A-Z0-9]+)/i);
  if (ngMatch) return { gateway: 'Nagad', payment_type: /Cash/i.test(ngMatch[1]) ? 'CASH_OUT' : 'SEND_MONEY', amount: parseFloat(ngMatch[2].replace(/,/g, '')), sender_phone: ngMatch[3], trx_id: ngMatch[4].toUpperCase() };

  const genMatch = text.match(/Tk\.?\s*([\d,]+(?:\.\d{1,2})?).*?(01\d{9,10}).*?(?:TrxID|TxnId)[:\s]+([A-Z0-9]+)/i);
  if (genMatch) return { gateway: /upay/i.test(sender + text) ? 'Upay' : 'Rocket', payment_type: /Cash Out|Cash-Out/i.test(text) ? 'CASH_OUT' : 'SEND_MONEY', amount: parseFloat(genMatch[1].replace(/,/g, '')), sender_phone: genMatch[2], trx_id: genMatch[3].toUpperCase() };

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Security: Only accept SMS from ACTIVE subscribed merchants or Owner!
  const apiKey = req.headers['shohojpay-api-key'] || req.query?.api_key || req.body?.api_key || '';
  if (!apiKey) return res.status(401).json({ status: false, message: 'API Key required' });

  const { data: merchant } = await supabase.from('merchants').select('id, plan_status, is_owner').eq('api_key', apiKey).maybeSingle();
  if (!merchant || (merchant.plan_status !== 'ACTIVE' && !merchant.is_owner)) {
    return res.status(401).json({ status: false, message: 'Active subscription required to sync SMS' });
  }

  const { sender, message } = req.body || {};
  const parsed = parseMfsSms(sender, message);
  if (!parsed) return res.status(422).json({ status: false, message: 'Unrecognized SMS' });

  const { data: existing } = await supabase.from('sms_logs').select('id').eq('trx_id', parsed.trx_id).maybeSingle();
  if (existing) return res.status(409).json({ status: false, message: 'Duplicate TrxID' });

  const { data: pendingInv } = await supabase.from('invoices').select('*').eq('status', 'PENDING').eq('amount', parsed.amount).order('created_at', { ascending: false }).limit(1).maybeSingle();
  let matchedInvoiceId = null;

  if (pendingInv) {
    matchedInvoiceId = pendingInv.invoice_id;
    await supabase.from('invoices').update({
      status: 'APPROVED', gateway: parsed.gateway, payment_type: parsed.payment_type,
      sender_phone: parsed.sender_phone, trx_id: parsed.trx_id, approved_at: new Date().toISOString()
    }).eq('id', pendingInv.id);

    if (pendingInv.customer_webhook_url) {
      try {
        await fetch(pendingInv.customer_webhook_url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'payment.approved', status: 'APPROVED', invoice_id: pendingInv.invoice_id, order_id: pendingInv.order_id, ...parsed })
        });
      } catch (e) {}
    }
  }

  await supabase.from('sms_logs').insert([{ ...parsed, raw_sms: message, is_used: Boolean(matchedInvoiceId), matched_invoice_id: matchedInvoiceId }]);
  return res.status(200).json({ status: true, auto_approved: Boolean(matchedInvoiceId), matched_invoice_id: matchedInvoiceId });
}
