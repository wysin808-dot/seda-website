/**
 * Self-hosted API server for sgeda.org.cn
 * Runs alongside Nginx (which serves static files)
 * Start: pm2 start server-selfhost.js --name seda-api
 */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

const PORT = Number(process.env.PORT || 3002);
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const CONSULTATION_SUFFIX = '如需获得个性化升学规划，请联系顾问老师。';
const CMS_VERSION = 'lite-1';
const CMS_CAPABILITIES = {
  auth: 'password-cookie',
  contentStore: 'markdown-frontmatter',
  analytics: 'jsonl-pageviews',
  workflow: ['draft', 'needs_revision', 'approved', 'archived'],
  futureReady: ['roles', 'media', 'scheduledPublish', 'revisionHistory', 'crmSync'],
};
const ANALYTICS_DIR = join(process.cwd(), 'data', 'analytics');
const ANALYTICS_FILE = join(ANALYTICS_DIR, 'events.jsonl');
const LEADS_DIR = join(process.cwd(), 'data', 'leads');
const LEADS_FILE = join(LEADS_DIR, 'leads.jsonl');

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

function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end();
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

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || '';
}

function hashVisitor(input) {
  return createHmac('sha256', authSecret() || 'seda-analytics').update(String(input || '')).digest('hex').slice(0, 16);
}

function inferRegion(timezone = '', language = '') {
  const tz = String(timezone).toLowerCase();
  const lang = String(language).toLowerCase();
  if (tz.includes('singapore')) return '新加坡';
  if (tz.includes('shanghai') || tz.includes('chongqing') || tz.includes('urumqi')) return '中国大陆';
  if (tz.includes('hong_kong')) return '中国香港';
  if (tz.includes('taipei')) return '中国台湾';
  if (tz.includes('macau')) return '中国澳门';
  if (tz.includes('kuala_lumpur')) return '马来西亚';
  if (tz.includes('jakarta')) return '印尼';
  if (tz.includes('bangkok')) return '泰国';
  if (tz.includes('tokyo')) return '日本';
  if (tz.includes('seoul')) return '韩国';
  if (tz.includes('sydney') || tz.includes('melbourne') || tz.includes('perth') || tz.includes('brisbane')) return '澳洲';
  if (tz.includes('london')) return '英国';
  if (tz.includes('new_york') || tz.includes('los_angeles') || tz.includes('chicago')) return '美国';
  if (lang.startsWith('zh-cn')) return '中国大陆';
  if (lang.startsWith('zh-sg') || lang.includes('en-sg')) return '新加坡';
  if (lang.startsWith('zh-hk')) return '中国香港';
  return '其他地区';
}

function cleanLocationPart(value = '') {
  return String(value || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^(unknown|null|undefined)$/i, '')
    .slice(0, 48);
}

function decodeHeaderValue(value = '') {
  const raw = String(value || '').split(',')[0].trim();
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function firstHeader(req, names) {
  for (const name of names) {
    const value = req.headers[name];
    if (value) return decodeHeaderValue(Array.isArray(value) ? value[0] : value);
  }
  return '';
}

function inferLocation(req, body = {}, timezone = '', language = '') {
  const region = inferRegion(timezone, language);
  const province = cleanLocationPart(
    body.province ||
    firstHeader(req, ['x-geoip-province', 'x-region-name', 'x-vercel-ip-country-region', 'cf-ipregion'])
  );
  const city = cleanLocationPart(
    body.city ||
    firstHeader(req, ['x-geoip-city', 'x-city-name', 'x-vercel-ip-city', 'cf-ipcity'])
  );

  if (province || city) {
    return {
      region,
      province,
      city,
      location: [province, city].filter(Boolean).join(' ') || region,
    };
  }

  const tz = String(timezone).toLowerCase();
  if (tz.includes('hong_kong')) return { region: '中国香港', province: '香港', city: '香港', location: '香港' };
  if (tz.includes('taipei')) return { region: '中国台湾', province: '台湾', city: '台北', location: '台湾 台北' };
  if (tz.includes('macau')) return { region: '中国澳门', province: '澳门', city: '澳门', location: '澳门' };
  if (tz.includes('singapore')) return { region: '新加坡', province: '新加坡', city: '新加坡', location: '新加坡' };
  if (tz.includes('chongqing')) return { region: '中国大陆', province: '重庆', city: '重庆', location: '重庆' };
  if (tz.includes('urumqi')) return { region: '中国大陆', province: '新疆', city: '乌鲁木齐', location: '新疆 乌鲁木齐' };

  return { region, province: '', city: '', location: region === '中国大陆' ? '中国大陆 未识别' : region };
}

function deviceType(ua = '') {
  const value = String(ua).toLowerCase();
  if (/bot|spider|crawl|slurp|baiduspider|bingbot|googlebot/.test(value)) return '爬虫';
  if (/ipad|tablet/.test(value)) return '平板';
  if (/mobile|iphone|android/.test(value)) return '手机';
  return '电脑';
}

function normalizePath(pathname = '') {
  const clean = String(pathname || '/').split('#')[0].split('?')[0] || '/';
  if (clean.startsWith('/api/') || clean.startsWith('/cms/') || clean.startsWith('/content-review/')) return '';
  return clean.length > 180 ? clean.slice(0, 180) : clean;
}

function readAnalyticsEvents(days = 30) {
  if (!existsSync(ANALYTICS_FILE)) return [];
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return readFileSync(ANALYTICS_FILE, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter((event) => event && Date.parse(event.ts) >= since);
}

function topCounts(events, key, limit = 10) {
  const counts = new Map();
  for (const event of events) {
    const value = event[key] || '未知';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function readJsonl(path, limit = 1000) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
  renameSync(tmp, path);
}

function cleanLeadText(value = '', max = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function leadId() {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function referrerSource(referrer = '') {
  if (!referrer) return '直接访问';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('baidu')) return '百度';
    if (host.includes('bing')) return 'Bing';
    if (host.includes('google')) return 'Google';
    if (host.includes('sogou')) return '搜狗';
    if (host.includes('wechat') || host.includes('weixin')) return '微信';
    if (host.includes('sgeda.org.cn')) return '站内';
    return host;
  } catch {
    return '其他来源';
  }
}

async function handleAnalyticsCollect(req, res) {
  let body;
  try { body = await readBody(req); } catch { return noContent(res); }
  const path = normalizePath(body.path || body.pathname || '');
  if (!path) return noContent(res);
  const timezone = String(body.timezone || '').slice(0, 80);
  const language = String(body.language || req.headers['accept-language'] || '').slice(0, 120);
  const visitorRaw = body.visitorId || `${clientIp(req)}:${req.headers['user-agent'] || ''}`;
  const location = inferLocation(req, body, timezone, language);
  const event = {
    ts: new Date().toISOString(),
    path,
    title: String(body.title || '').slice(0, 140),
    referrer: String(body.referrer || '').slice(0, 240),
    source: referrerSource(body.referrer || ''),
    region: location.region,
    province: location.province,
    city: location.city,
    location: location.location,
    timezone,
    language,
    device: deviceType(req.headers['user-agent'] || body.userAgent || ''),
    visitor: hashVisitor(visitorRaw),
  };
  mkdirSync(ANALYTICS_DIR, { recursive: true });
  appendFileSync(ANALYTICS_FILE, `${JSON.stringify(event)}\n`, 'utf8');
  noContent(res);
}

async function handleCreateLead(req, res) {
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }

  const contact = cleanLeadText(body.contact || body.phone || body.wechat || body.whatsapp, 120);
  if (!contact) return json(res, 400, { error: '请填写微信 / WhatsApp / 手机等联系方式' });

  const timezone = cleanLeadText(body.timezone, 80);
  const language = cleanLeadText(body.language || req.headers['accept-language'], 120);
  const location = inferLocation(req, body, timezone, language);
  const now = new Date().toISOString();
  const lead = {
    id: leadId(),
    createdAt: now,
    updatedAt: now,
    name: cleanLeadText(body.name, 80),
    contact,
    phone: cleanLeadText(body.phone, 80),
    wechat: cleanLeadText(body.wechat, 80),
    whatsapp: cleanLeadText(body.whatsapp, 80),
    studentAge: cleanLeadText(body.studentAge || body.age, 40),
    grade: cleanLeadText(body.grade || body.stage, 60),
    englishLevel: cleanLeadText(body.englishLevel || body.english_level, 80),
    target: cleanLeadText(body.target || body.program || body.pathway || body.track || body.uni_target, 120),
    message: cleanLeadText(body.message || body.note || body.notes, 600),
    sourcePage: normalizePath(body.sourcePage || body.path || req.headers.referer || '/'),
    referrer: cleanLeadText(body.referrer || req.headers.referer, 240),
    source: referrerSource(body.referrer || req.headers.referer || ''),
    campaign: cleanLeadText(body.campaign || body.utm_campaign, 120),
    utmSource: cleanLeadText(body.utmSource || body.utm_source, 120),
    utmMedium: cleanLeadText(body.utmMedium || body.utm_medium, 120),
    tool: cleanLeadText(body.tool, 80),
    formType: cleanLeadText(body.formType || body.form_type, 80),
    region: location.region,
    province: location.province,
    city: location.city,
    location: location.location,
    device: deviceType(req.headers['user-agent'] || body.userAgent || ''),
    status: 'new',
    crmStatus: 'pending',
    crmExternalId: '',
    visitor: hashVisitor(body.visitorId || `${clientIp(req)}:${req.headers['user-agent'] || ''}`),
  };

  mkdirSync(LEADS_DIR, { recursive: true });
  appendFileSync(LEADS_FILE, `${JSON.stringify(lead)}\n`, 'utf8');
  json(res, 200, { ok: true, id: lead.id });
}

function handleCmsLeads(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);
  const leads = readJsonl(LEADS_FILE, limit).reverse();
  json(res, 200, {
    ok: true,
    count: leads.length,
    leads,
    fields: ['id', 'createdAt', 'name', 'contact', 'grade', 'target', 'message', 'sourcePage', 'source', 'location', 'status', 'crmStatus'],
  });
}

async function handleCmsLeadUpdate(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const id = cleanLeadText(body.id, 80);
  if (!id) return json(res, 400, { error: '缺少线索 ID' });
  const allowedStatus = new Set(['new', 'contacted', 'invalid', 'archived']);
  const allowedCrmStatus = new Set(['pending', 'synced', 'failed', 'skipped']);
  const rows = readJsonl(LEADS_FILE, 100000);
  const index = rows.findIndex((lead) => lead.id === id);
  if (index === -1) return json(res, 404, { error: '线索不存在' });
  const next = { ...rows[index], updatedAt: new Date().toISOString() };
  if (body.status !== undefined) {
    const status = cleanLeadText(body.status, 40);
    if (!allowedStatus.has(status)) return json(res, 400, { error: '线索状态不合法' });
    next.status = status;
  }
  if (body.crmStatus !== undefined) {
    const crmStatus = cleanLeadText(body.crmStatus, 40);
    if (!allowedCrmStatus.has(crmStatus)) return json(res, 400, { error: 'CRM 状态不合法' });
    next.crmStatus = crmStatus;
  }
  if (body.crmExternalId !== undefined) next.crmExternalId = cleanLeadText(body.crmExternalId, 120);
  if (body.note !== undefined) next.note = cleanLeadText(body.note, 500);
  rows[index] = next;
  writeJsonl(LEADS_FILE, rows);
  json(res, 200, { ok: true, lead: next });
}

function csvCell(value = '') {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function handleCmsLeadsExport(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const leads = readJsonl(LEADS_FILE, 100000).reverse();
  const headers = ['createdAt', 'name', 'contact', 'grade', 'target', 'message', 'sourcePage', 'source', 'location', 'status', 'crmStatus', 'note'];
  const rows = [headers.join(',')].concat(leads.map((lead) => headers.map((key) => csvCell(lead[key] || '')).join(',')));
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="seda-leads.csv"',
    'Cache-Control': 'no-store',
  });
  res.end(`\uFEFF${rows.join('\n')}\n`);
}

function handleCmsAnalytics(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30), 1), 90);
  const events = readAnalyticsEvents(days);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((event) => String(event.ts).startsWith(todayKey));
  const visitors = new Set(events.map((event) => event.visitor)).size;
  const todayVisitors = new Set(todayEvents.map((event) => event.visitor)).size;
  const recent = events.slice(-20).reverse().map((event) => ({
    ts: event.ts,
    path: event.path,
    title: event.title,
    source: event.source,
    region: event.region,
    province: event.province || '',
    city: event.city || '',
    location: event.location || event.region || '未知',
    device: event.device,
  }));
  json(res, 200, {
    ok: true,
    days,
    totals: {
      pageviews: events.length,
      visitors,
      todayPageviews: todayEvents.length,
      todayVisitors,
    },
    regions: topCounts(events, 'region', 12),
    locations: topCounts(events, 'location', 12),
    provinces: topCounts(events, 'province', 12),
    pages: topCounts(events, 'path', 12),
    sources: topCounts(events, 'source', 10),
    devices: topCounts(events, 'device', 6),
    recent,
  });
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

function makeArticleUrl(meta) {
  const slug = meta.slug || meta.title;
  return `/${meta.category || 'guides'}/${slug}/`.replace(/\/+/g, '/');
}

function removeGeneratedArticlePage(meta) {
  if (!meta?.slug) return;
  const relUrl = makeArticleUrl(meta).replace(/^\/+/, '');
  const dir = join(process.cwd(), relUrl);
  const rel = relative(process.cwd(), dir);
  if (!rel || rel.startsWith('..') || rel === '.' || rel.split(sep).length < 2) return;
  if (existsSync(join(dir, 'index.html'))) {
    // Remove only generated article directories managed from content/articles.
    rmSync(dir, { recursive: true, force: true });
  }
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
        updated: meta.updated || '',
        publishedAt: meta.publishedAt || '',
        slug: meta.slug || '',
      };
    })
    .sort((a, b) => Number(b.draft) - Number(a.draft) || String(b.date).localeCompare(String(a.date)));
  json(res, 200, { ok: true, articles });
}

function cmsStats(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const articleDir = join(process.cwd(), 'content', 'articles');
  const stats = { total: 0, draft: 0, needsRevision: 0, published: 0 };
  if (existsSync(articleDir)) {
    for (const file of readdirSync(articleDir).filter((item) => item.endsWith('.md') && !item.startsWith('_'))) {
      const { meta } = parseFrontmatter(readFileSync(join(articleDir, file), 'utf8'));
      stats.total += 1;
      if (meta.draft) stats.draft += 1;
      else stats.published += 1;
      if (meta.reviewStatus === 'needs_revision') stats.needsRevision += 1;
    }
  }
  json(res, 200, { ok: true, version: CMS_VERSION, capabilities: CMS_CAPABILITIES, stats });
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
  let stamped;
  try {
    stamped = replaceFrontmatterValue(`${content}\n`, 'updated', new Date().toISOString().slice(0, 10));
  } catch {
    return json(res, 400, { error: '文章 frontmatter 格式不完整，请检查开头和结尾的 ---' });
  }
  writeFileSync(fullPath, stamped, 'utf8');
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
      const raw = readFileSync(articlePath, 'utf8');
      const { meta } = parseFrontmatter(raw);
      removeGeneratedArticlePage(meta);
      const archiveDir = join(process.cwd(), 'content', 'archived-articles');
      mkdirSync(archiveDir, { recursive: true });
      renameSync(articlePath, join(archiveDir, `${Date.now()}-${fileName}`));
    } else {
      let raw = readFileSync(articlePath, 'utf8');
      raw = replaceFrontmatterValue(raw, 'draft', action !== 'approve');
      raw = replaceFrontmatterValue(raw, 'reviewStatus', action === 'approve' ? 'approved' : 'needs_revision');
      raw = replaceFrontmatterValue(raw, 'reviewedAt', new Date().toISOString());
      raw = replaceFrontmatterValue(raw, 'updated', new Date().toISOString().slice(0, 10));
      if (action === 'approve') raw = replaceFrontmatterValue(raw, 'publishedAt', new Date().toISOString());
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
  if (req.method === 'GET' && url.pathname === '/api/cms/status') return cmsStats(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/analytics') return handleCmsAnalytics(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/cms/leads') return handleCmsLeads(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/cms/leads/export') return handleCmsLeadsExport(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/lead') return handleCmsLeadUpdate(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/articles') return listCmsArticles(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/article') return getCmsArticle(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/article') return saveCmsArticle(req, res);
  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'POST' && url.pathname === '/api/content-review') return handleContentReview(req, res);
  if (req.method === 'POST' && url.pathname === '/api/analytics/collect') return handleAnalyticsCollect(req, res);
  if (req.method === 'POST' && url.pathname === '/api/leads') return handleCreateLead(req, res);
  if (req.method === 'GET'  && url.pathname === '/api/config') return handleConfig(req, res);
  if (req.method === 'POST' && url.pathname === '/api/wechat-click') return json(res, 200, { ok: true });

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SEDA API server running on port ${PORT}`);
});
