// Vercel Serverless Function: /api/chat
// Proxies to DeepSeek API and optionally logs to Supabase

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const CONSULTATION_SUFFIX = '如需获得个性化升学规划，请联系顾问老师。';

const SYSTEM_PROMPT = `你是SEDA新加坡留学平台的AI升学顾问。

主要回答关于新加坡留学的问题：
- AEIS 考试（报名、备考、时间表）
- O-Level 课程与考试
- WACE 西澳课程
- A-Level / IB 课程
- 新加坡国际学校选校
- 新加坡政府学校入学
- NUS/NTU/SMU 大学申请
- 留学费用与生活安排
- 学生准证与陪读准证

回答要求：
1. 简洁易懂，300字以内
2. 不编造信息，不确定时说不确定
3. 不承诺录取结果
4. 可以推荐用户访问 seda.org.sg 上的相关页面
5. 结尾引导用户咨询

回答结尾统一增加：${CONSULTATION_SUFFIX}`;

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: '请输入问题' });
    return;
  }
  if (question.length > 500) {
    res.status(400).json({ error: '问题请控制在500字以内' });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI服务未配置，请联系管理员' });
    return;
  }

  try {
    const aiRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question.trim() },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!aiRes.ok) {
      const msg = aiRes.status === 401
        ? 'AI服务配置有误，请联系管理员'
        : `AI服务暂时异常（${aiRes.status}）`;
      res.status(502).json({ error: msg });
      return;
    }

    const data = await aiRes.json();
    const rawAnswer = data.choices?.[0]?.message?.content?.trim() || '';
    const answer = rawAnswer
      ? rawAnswer.includes(CONSULTATION_SUFFIX) ? rawAnswer : `${rawAnswer}\n\n${CONSULTATION_SUFFIX}`
      : CONSULTATION_SUFFIX;

    // Log to Supabase (non-blocking)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    insertSupabase('ai_assistant_chats', { ip_address: ip, question: question.trim(), answer });

    res.status(200).json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'AI服务暂时无法连接，请稍后重试' });
  }
}
