/**
 * Self-hosted API server for sgeda.org.cn
 * Runs alongside Nginx (which serves static files)
 * Start: pm2 start server-selfhost.js --name seda-api
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';

const PORT = Number(process.env.PORT || 3001);
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const CONSULTATION_SUFFIX = '如需获得个性化升学规划，请联系顾问老师。';

// Load .env file
function loadEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv('.env');
loadEnv('.env.local');

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
2. 不编造信息
3. 不承诺录取结果
4. 结尾引导咨询

回答结尾统一增加：${CONSULTATION_SUFFIX}`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8000) { req.destroy(); reject(new Error('Too large')); } });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

async function handleChat(req, res) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const question = String(body.question || '').trim();
  if (!question) return json(res, 400, { error: '请输入问题' });
  if (question.length > 500) return json(res, 400, { error: '问题请控制在500字以内' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return json(res, 500, { error: 'AI服务未配置，请联系管理员' });

  try {
    const aiRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: question }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    if (!aiRes.ok) {
      const msg = aiRes.status === 401 ? 'AI服务配置有误' : `AI服务异常（${aiRes.status}）`;
      return json(res, 502, { error: msg });
    }
    const data = await aiRes.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const answer = raw ? (raw.includes(CONSULTATION_SUFFIX) ? raw : `${raw}\n\n${CONSULTATION_SUFFIX}`) : CONSULTATION_SUFFIX;
    json(res, 200, { answer });
  } catch {
    json(res, 500, { error: 'AI服务暂时无法连接' });
  }
}

function handleConfig(req, res) {
  json(res, 200, {
    wechatId: process.env.WECHAT_ID || '',
    wechatQrUrl: process.env.WECHAT_QR_URL || '',
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // CORS preflight
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }); return res.end(); }

  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET'  && url.pathname === '/api/config') return handleConfig(req, res);
  if (req.method === 'POST' && url.pathname === '/api/wechat-click') return json(res, 200, { ok: true });

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SEDA API server running on port ${PORT}`);
});
