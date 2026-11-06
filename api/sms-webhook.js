import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Parses Bangladeshi MFS SMS (bKash, Nagad, Rocket, Upay)
 * Supports BOTH Personal "Send Money" AND Agent "Cash Out" / "Cash In" messages!
 */
function parseMfsSms(sender = '', message = '') {
  const text = message.trim();

  // 1. bKash (Send Money: "You have received Tk 500.00 from 017... TrxID BK..." OR Agent Cash Out: "Cash Out Tk 500.00 from 017... TrxID BK...")
  const bkashRegex = /(received|Cash Out|Cash In|Payment)\s+Tk\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+(01\d{9}).*?TrxID\s+([A-Z0-9]+)/i;
  const bkMatch = text.match(bkashRegex);
  if (bkMatch) {
    return {
      gateway: 'bKash',
      payment_type: /Cash Out/i.test(bkMatch[1]) ? 'CASH_OUT' : 'SEND_MONEY',
      amount: parseFloat(bkMatch[2].replace(/,/g, '')),
      sender_phone: bkMatch[3],
      trx_id: bkMatch[4].toUpperCase()
    };
  }

  // 2. Nagad (Send Money: "Money Received. Amount: Tk 500.00. Sender: 018... TxnID: 72N..." OR Cash Out)
  const nagadRegex = /(Money Received|Cash Out|Cash-Out).*?Amount:\s*Tk\s*([\d,]+(?:\.\d{1,2})?).*?(?:Sender|Customer|From):\s*(01\d{9}).*?(?:TxnID|TrxID):\s*([A-Z0-9]+)/i;
  const ngMatch = text.match(nagadRegex);
  if (ngMatch) {
    return {
      gateway: 'Nagad',
      payment_type: /Cash/i.test(ngMatch[1]) ? 'CASH_OUT' : 'SEND_MONEY',
      amount: parseFloat(ngMatch[2].replace(/,/g, '')),
      sender_phone: ngMatch[3],
      trx_id: ngMatch[4].toUpperCase()
    };
  }

  // 3. Rocket & Upay (Send Money & Cash Out)
  const genericRegex = /Tk\.?\s*([\d,]+(?:\.\d{1,2})?).*?(01\d{9,10}).*?(?:TrxID|TxnId)[:\s]+([A-Z0-9]+)/i;
  const genMatch = text.match(genericRegex);
  if (genMatch) {
    const isUpay = /upay/i.test(sender) || /upay/i.test(text);
    return {
      gateway: isUpay ? 'Upay' : 'Rocket',
      payment_type: /Cash Out|Cash-Out/i.test(text) ? 'CASH_OUT' : 'SEND_MONEY',
      amount: parseFloat(genMatch[1].replace(/,/g, '')),
      sender_phone: genMatch[2],
      trx_id: genMatch[3].toUpperCase()
    };
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method Not Allowed' });

  const apiKey = req.headers['shohojpay-api-key'] || req.query?.api_key || req.body?.api_key;
  if (!apiKey || apiKey !== (process.env.MERCHANT_API_KEY || 'sp_live_98a72b41c65d89e01f23a45b')) {
    return res.status(401).json({ status: false, message: 'Unauthorized API Key' });
  }

  const { sender, message } = req.body || {};
  const parsed = parseMfsSms(sender, message);
  if (!parsed) {
    return res.status(422).json({ status: false, message: 'Unrecognized MFS SMS format' });
  }

  // 1. Check Duplicate TrxID Fraud
  const { data: existingSms } = await supabase
    .from('sms_logs')
    .select('id')
    .eq('trx_id', parsed.trx_id)
    .maybeSingle();

  if (existingSms) {
    return res.status(409).json({ status: false, message: 'Duplicate TrxID blocked' });
  }

  // 2. Find matching PENDING invoice with exact same amount
  const { data: pendingInvoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'PENDING')
    .eq('amount', parsed.amount)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let matchedInvoiceId = null;

  if (pendingInvoice) {
    matchedInvoiceId = pendingInvoice.invoice_id;

    // Mark Invoice APPROVED in Supabase (Triggers Realtime UI update on Checkout Page!)
    await supabase
      .from('invoices')
      .update({
        status: 'APPROVED',
        gateway: parsed.gateway,
        payment_type: parsed.payment_type,
        sender_phone: parsed.sender_phone,
        trx_id: parsed.trx_id,
        approved_at: new Date().toISOString()
      })
      .eq('id', pendingInvoice.id);

    // Fire Instant Auto-Approval Webhook to Customer's Website
    if (pendingInvoice.customer_webhook_url) {
      try {
        await fetch(pendingInvoice.customer_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.approved',
            status: 'APPROVED',
            invoice_id: pendingInvoice.invoice_id,
            order_id: pendingInvoice.order_id,
            amount: parsed.amount,
            gateway: parsed.gateway,
            payment_type: parsed.payment_type,
            sender_phone: parsed.sender_phone,
            trx_id: parsed.trx_id
          })
        });
      } catch (err) {
        console.error('Customer webhook error:', err.message);
      }
    }
  }

  // 3. Save SMS in sms_logs
  await supabase.from('sms_logs').insert([{
    gateway: parsed.gateway,
    payment_type: parsed.payment_type,
    amount: parsed.amount,
    sender_phone: parsed.sender_phone,
    trx_id: parsed.trx_id,
    raw_sms: message,
    is_used: Boolean(matchedInvoiceId),
    matched_invoice_id: matchedInvoiceId
  }]);

  return res.status(200).json({
    status: true,
    auto_approved: Boolean(matchedInvoiceId),
    matched_invoice_id: matchedInvoiceId,
    parsed
  });
}
