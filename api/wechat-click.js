// Vercel Serverless Function: /api/wechat-click
// Logs WeChat button clicks to Supabase

async function insertSupabase(table, payload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  await insertSupabase('ai_assistant_events', { event_type: 'wechat_click', ip_address: ip });
  res.status(200).json({ ok: true });
}
