import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, shohojpay-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const apiKey = req.headers['shohojpay-api-key'];
  const { data: merchant } = await supabase.from('merchants').select('*').eq('api_key', apiKey).maybeSingle();
  if (!merchant || (merchant.plan_status !== 'ACTIVE' && !merchant.is_owner)) {
    return res.status(401).json({ status: false, message: 'Active subscription required' });
  }

  if (req.method === 'POST') {
    const { site_name, site_url, webhook_url } = req.body || {};
    if (!site_name || !site_url) return res.status(400).json({ status: false, message: 'ওয়েবসাইটের নাম ও লিংক দিন।' });
    const siteKey = 'sp_site_' + crypto.randomBytes(10).toString('hex');
    const { data, error } = await supabase.from('merchant_websites').insert([{
      merchant_email: merchant.email,
      site_name: site_name.trim(),
      site_url: site_url.trim(),
      site_api_key: siteKey,
      webhook_url: (webhook_url || '').trim(),
      is_active: true
    }]).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, website: data });
  }

  if (req.method === 'PATCH') {
    const { id, regenerate_key, is_active, webhook_url } = req.body || {};
    if (!id) return res.status(400).json({ status: false, message: 'Website ID required' });
    const updates = {};
    if (regenerate_key) updates.site_api_key = 'sp_site_' + crypto.randomBytes(10).toString('hex');
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (webhook_url !== undefined) updates.webhook_url = webhook_url.trim();
    const { data, error } = await supabase.from('merchant_websites').update(updates).eq('id', id).eq('merchant_email', merchant.email).select().single();
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, website: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    const { error } = await supabase.from('merchant_websites').delete().eq('id', id).eq('merchant_email', merchant.email);
    if (error) return res.status(500).json({ status: false, message: error.message });
    return res.status(200).json({ status: true, deleted: id });
  }

  const { data: websites } = await supabase.from('merchant_websites').select('*').eq('merchant_email', merchant.email).order('created_at', { ascending: false });
  return res.status(200).json({ status: true, websites: websites || [] });
}
