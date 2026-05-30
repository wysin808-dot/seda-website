// Vercel Serverless Function: /api/config
// Returns WeChat advisor config for the AI chat widget

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  res.status(200).json({
    wechatId: process.env.NEXT_PUBLIC_ADVISOR_WECHAT_ID || process.env.NEXT_PUBLIC_SEDA_WECHAT_ID || '',
    wechatQrUrl: process.env.NEXT_PUBLIC_ADVISOR_WECHAT_QR_URL || process.env.NEXT_PUBLIC_SEDA_WECHAT_QR_URL || '',
  });
}
