export default function handler(req, res) {
  res.status(200).json({
    status: true,
    service: 'ShohojPay Platform Live API',
    supabase_connected: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    repo: 'https://github.com/freefireaivideo23372-wq/shohojpay-platform'
  });
}
