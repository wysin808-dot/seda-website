/**
 * Self-hosted API server for sgeda.org.cn
 * Runs alongside Nginx (which serves static files)
 * Start: pm2 start server-selfhost.js --name seda-api
 */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

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
    req.on('data', chunk => { body += chunk; if (body.length > 240000) { req.destroy(); reject(new Error('Too large')); } });
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

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return ['', ''];
    return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())];
  }).filter(([key]) => key));
}

function authSecret() {
  return process.env.CMS_SESSION_SECRET || process.env.REVIEW_ADMIN_TOKEN || '';
}

function signSession(value) {
  return createHmac('sha256', authSecret()).update(value).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function createSessionCookie() {
  const payload = `${Date.now()}.admin`;
  const token = `${payload}.${signSession(payload)}`;
  return `seda_cms=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`;
}

function isAuthenticated(req) {
  const secret = authSecret();
  if (!secret) return false;
  const token = parseCookies(req).seda_cms || '';
  const parts = token.split('.');
  if (parts.length < 3) return false;
  const signature = parts.pop();
  const payload = parts.join('.');
  const issuedAt = Number(parts[0]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 7 * 24 * 60 * 60 * 1000) return false;
  return safeEqual(signature, signSession(payload));
}

function requireCmsAuth(req, res) {
  if (isAuthenticated(req)) return true;
  json(res, 401, { error: '请先登录 CMS 后台' });
  return false;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value === 'true') meta[key] = true;
    else if (value === 'false') meta[key] = false;
    else meta[key] = value;
  }
  return { meta, body: match[2] };
}

function articleFilePath(file) {
  const fileName = basename(String(file || '').trim());
  if (!fileName.endsWith('.md') || fileName.startsWith('_')) return null;
  return join(process.cwd(), 'content', 'articles', fileName);
}

function relativeArticlePath(fullPath) {
  return relative(process.cwd(), fullPath).replaceAll(sep, '/');
}

function replaceFrontmatterValue(raw, key, value) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter');
  const lines = match[1].split('\n');
  const nextValue = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  let found = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith(`${key}:`)) return line;
    found = true;
    return typeof value === 'boolean' ? `${key}: ${value}` : `${key}: "${nextValue}"`;
  });
  if (!found) nextLines.push(typeof value === 'boolean' ? `${key}: ${value}` : `${key}: "${nextValue}"`);
  return `---\n${nextLines.join('\n')}\n---\n${match[2]}`;
}

function rebuildContent() {
  return new Promise((resolve, reject) => {
    execFile('npm', ['run', 'content:build'], { cwd: process.cwd(), timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        error.output = `${stdout || ''}${stderr || ''}`;
        reject(error);
        return;
      }
      resolve(`${stdout || ''}${stderr || ''}`);
    });
  });
}

function requireReviewToken(body, res) {
  const expected = process.env.REVIEW_ADMIN_TOKEN || '';
  if (!expected) {
    json(res, 503, { error: '审核口令未配置，请先在服务器 .env 设置 REVIEW_ADMIN_TOKEN' });
    return false;
  }
  const token = String(body.token || '').trim();
  if (token !== expected) {
    json(res, 401, { error: '审核口令错误' });
    return false;
  }
  return true;
}

function requireReviewAccess(req, body, res) {
  if (isAuthenticated(req)) return true;
  return requireReviewToken(body, res);
}

async function handleCmsLogin(req, res) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const expected = process.env.CMS_ADMIN_PASSWORD || process.env.REVIEW_ADMIN_TOKEN || '';
  if (!expected) return json(res, 503, { error: 'CMS 登录密码未配置' });
  if (!safeEqual(String(body.password || '').trim(), expected)) return json(res, 401, { error: '登录密码错误' });
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': createSessionCookie(),
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ ok: true }));
}

function handleCmsLogout(req, res) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': 'seda_cms=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ ok: true }));
}

function listCmsArticles(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const articleDir = join(process.cwd(), 'content', 'articles');
  const articles = readdirSync(articleDir)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => {
      const fullPath = join(articleDir, file);
      const raw = readFileSync(fullPath, 'utf8');
      const { meta } = parseFrontmatter(raw);
      return {
        file: relativeArticlePath(fullPath),
        title: meta.title || file,
        description: meta.description || '',
        category: meta.categoryLabel || meta.category || 'SEO文章',
        date: meta.date || '',
        draft: Boolean(meta.draft),
        reviewStatus: meta.reviewStatus || (meta.draft ? 'pending' : 'approved'),
        reviewNote: meta.reviewNote || '',
        slug: meta.slug || '',
      };
    })
    .sort((a, b) => Number(b.draft) - Number(a.draft) || String(b.date).localeCompare(String(a.date)));
  json(res, 200, { ok: true, articles });
}

function getCmsArticle(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const fullPath = articleFilePath(url.searchParams.get('file'));
  if (!fullPath || !existsSync(fullPath)) return json(res, 404, { error: '文章不存在' });
  const raw = readFileSync(fullPath, 'utf8');
  const { meta } = parseFrontmatter(raw);
  json(res, 200, { ok: true, file: relativeArticlePath(fullPath), meta, content: raw });
}

async function saveCmsArticle(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const fullPath = articleFilePath(body.file);
  const content = String(body.content || '').trim();
  if (!fullPath || !existsSync(fullPath)) return json(res, 404, { error: '文章不存在' });
  if (!content.startsWith('---')) return json(res, 400, { error: '请保留文章 frontmatter（开头的 --- 配置区）' });
  writeFileSync(fullPath, `${content}\n`, 'utf8');
  try {
    const output = await rebuildContent();
    json(res, 200, { ok: true, output });
  } catch (error) {
    json(res, 500, { error: '保存成功，但内容构建失败', detail: error.output || error.message });
  }
}

async function handleContentReview(req, res) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  if (!requireReviewAccess(req, body, res)) return;

  const action = String(body.action || '').trim();
  const fileName = basename(String(body.file || '').trim());
  if (!['approve', 'revise', 'archive'].includes(action)) return json(res, 400, { error: '未知审核操作' });
  if (!fileName.endsWith('.md') || fileName.startsWith('_')) return json(res, 400, { error: '文章文件无效' });

  const articlePath = articleFilePath(fileName);
  if (!existsSync(articlePath)) return json(res, 404, { error: '文章不存在' });

  try {
    if (action === 'archive') {
      const archiveDir = join(process.cwd(), 'content', 'archived-articles');
      mkdirSync(archiveDir, { recursive: true });
      renameSync(articlePath, join(archiveDir, `${Date.now()}-${fileName}`));
    } else {
      let raw = readFileSync(articlePath, 'utf8');
      raw = replaceFrontmatterValue(raw, 'draft', action !== 'approve');
      raw = replaceFrontmatterValue(raw, 'reviewStatus', action === 'approve' ? 'approved' : 'needs_revision');
      if (body.note) raw = replaceFrontmatterValue(raw, 'reviewNote', String(body.note).slice(0, 300));
      writeFileSync(articlePath, raw, 'utf8');
    }
    const output = await rebuildContent();
    json(res, 200, { ok: true, action, output });
  } catch (error) {
    json(res, 500, { error: '审核操作失败', detail: error.output || error.message });
  }
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

  if (req.method === 'POST' && url.pathname === '/api/cms/login') return handleCmsLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/logout') return handleCmsLogout(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/me') return json(res, 200, { authenticated: isAuthenticated(req) });
  if (req.method === 'GET' && url.pathname === '/api/cms/articles') return listCmsArticles(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/article') return getCmsArticle(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/article') return saveCmsArticle(req, res);
  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'POST' && url.pathname === '/api/content-review') return handleContentReview(req, res);
  if (req.method === 'GET'  && url.pathname === '/api/config') return handleConfig(req, res);
  if (req.method === 'POST' && url.pathname === '/api/wechat-click') return json(res, 200, { ok: true });

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SEDA API server running on port ${PORT}`);
});
