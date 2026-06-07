/**
 * Self-hosted API server for sgeda.org.cn
 * Runs alongside Nginx (which serves static files)
 * Start: pm2 start server-selfhost.js --name seda-api
 */

import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, sep } from 'node:path';
import { optimizeArticle } from './scripts/seo-optimizer.mjs';

const PORT = Number(process.env.PORT || 3002);
const require = createRequire(import.meta.url);
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const CONSULTATION_SUFFIX = '如需获得个性化升学规划，请联系顾问老师。';
const DEFAULT_GOOGLE_ANALYTICS_ID = 'G-38WFES3WTH';
const CMS_VERSION = 'lite-1';
const CMS_CAPABILITIES = {
  auth: 'team-account-cookie',
  contentStore: 'markdown-frontmatter',
  analytics: 'jsonl-pageviews',
  geoIp: 'optional-local-ip2region',
  workflow: ['draft', 'needs_revision', 'approved', 'archived'],
  futureReady: ['pageMatrix', 'roles', 'media', 'aiQueue', 'scheduledPublish', 'revisionHistory', 'crmSync'],
};
const ANALYTICS_DIR = join(process.cwd(), 'data', 'analytics');
const ANALYTICS_FILE = join(ANALYTICS_DIR, 'events.jsonl');
const LEADS_DIR = join(process.cwd(), 'data', 'leads');
const LEADS_FILE = join(LEADS_DIR, 'leads.jsonl');
const SEO_DIR = join(process.cwd(), 'data', 'seo');
const SEO_DAILY_FILE = join(SEO_DIR, 'daily.jsonl');
const SEO_SUBMISSION_FILE = join(SEO_DIR, 'submissions.jsonl');
const CMS_DATA_DIR = join(process.cwd(), 'data', 'cms');
const CMS_PAGES_FILE = join(CMS_DATA_DIR, 'pages.jsonl');
const CMS_USERS_FILE = join(CMS_DATA_DIR, 'users.jsonl');
const CMS_MEDIA_FILE = join(CMS_DATA_DIR, 'media.jsonl');
const CMS_AI_JOBS_FILE = join(CMS_DATA_DIR, 'ai-jobs.jsonl');
const CMS_MEDIA_DIR = join(process.cwd(), 'assets', 'uploads', 'cms');

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
    req.on('data', chunk => { body += chunk; if (body.length > 4200000) { req.destroy(); reject(new Error('Too large')); } });
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

function createSessionCookie(user = null) {
  const sessionUser = user || { username: 'admin', role: 'admin', team: 'all', name: '管理员' };
  const payload = Buffer.from(JSON.stringify({
    iat: Date.now(),
    username: cleanLeadText(sessionUser.username || 'admin', 80),
    role: cleanLeadText(sessionUser.role || 'admin', 40),
    team: cleanLeadText(sessionUser.team || 'all', 80),
    name: cleanLeadText(sessionUser.name || sessionUser.username || '管理员', 80),
  })).toString('base64url');
  const token = `${payload}.${signSession(payload)}`;
  return `seda_cms=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`;
}

function cmsSession(req) {
  const secret = authSecret();
  if (!secret) return null;
  const token = parseCookies(req).seda_cms || '';
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const signature = parts.pop();
  const payload = parts.join('.');
  if (!safeEqual(signature, signSession(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const issuedAt = Number(data.iat);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return {
      username: cleanLeadText(data.username || 'admin', 80),
      role: cleanLeadText(data.role || 'admin', 40),
      team: cleanLeadText(data.team || 'all', 80),
      name: cleanLeadText(data.name || data.username || '管理员', 80),
    };
  } catch {
    const legacyIssuedAt = Number(parts[0]);
    if (!Number.isFinite(legacyIssuedAt) || Date.now() - legacyIssuedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return { username: parts[1] || 'admin', role: 'admin', team: 'all', name: '管理员' };
  }
}

function isAuthenticated(req) {
  return Boolean(cmsSession(req));
}

function requireCmsAuth(req, res) {
  if (isAuthenticated(req)) return true;
  json(res, 401, { error: '请先登录 CMS 后台' });
  return false;
}

function normalizeIp(value = '') {
  let ip = String(value || '').trim();
  if (!ip) return '';
  ip = ip.replace(/^::ffff:/i, '');
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  return ip;
}

function isPrivateIp(value = '') {
  const ip = normalizeIp(value);
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

function clientIp(req) {
  const candidates = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(normalizeIp)
    .filter(Boolean);
  const realIp = normalizeIp(req.headers['x-real-ip'] || '');
  if (realIp) candidates.push(realIp);
  candidates.push(normalizeIp(req.socket.remoteAddress || ''));
  return candidates.find((ip) => !isPrivateIp(ip)) || candidates.find(Boolean) || '';
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

function normalizeChinaPlaceName(value = '') {
  const name = cleanLocationPart(value);
  if (!name) return '';
  const special = new Map([
    ['内蒙古自治区', '内蒙古'],
    ['广西壮族自治区', '广西'],
    ['西藏自治区', '西藏'],
    ['宁夏回族自治区', '宁夏'],
    ['新疆维吾尔自治区', '新疆'],
    ['香港特别行政区', '香港'],
    ['澳门特别行政区', '澳门'],
  ]);
  if (special.has(name)) return special.get(name);
  return name.replace(/(省|市|地区|盟)$/u, '');
}

function isMainlandProvince(value = '') {
  return new Set([
    '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽',
    '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
    '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
  ]).has(normalizeChinaPlaceName(value));
}

let ip2RegionSearcher;
let ip2RegionError = '';

function getIp2RegionSearcher() {
  if (ip2RegionSearcher !== undefined) return ip2RegionSearcher;
  try {
    const mod = require('ip2region');
    const IP2Region = mod.default || mod;
    ip2RegionSearcher = new IP2Region({
      ipv4db: process.env.IP2REGION_IPV4_DB || undefined,
      ipv6db: process.env.IP2REGION_IPV6_DB || undefined,
    });
    ip2RegionError = '';
  } catch (error) {
    ip2RegionSearcher = null;
    ip2RegionError = error?.code === 'MODULE_NOT_FOUND' ? 'ip2region dependency is not installed' : String(error?.message || error);
  }
  return ip2RegionSearcher;
}

function lookupLocalIpLocation(ip = '') {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp || isPrivateIp(cleanIp)) return null;
  const searcher = getIp2RegionSearcher();
  if (!searcher) return null;
  try {
    const result = searcher.search(cleanIp);
    if (!result || !result.country) return null;
    const country = cleanLocationPart(result.country);
    const province = normalizeChinaPlaceName(result.province);
    const city = normalizeChinaPlaceName(result.city);
    if (country === '中国') {
      if (province === '香港') return { region: '中国香港', province: '香港', city: city || '香港', location: city && city !== '香港' ? `香港 ${city}` : '香港' };
      if (province === '澳门') return { region: '中国澳门', province: '澳门', city: city || '澳门', location: city && city !== '澳门' ? `澳门 ${city}` : '澳门' };
      if (province === '台湾') return { region: '中国台湾', province: '台湾', city, location: [province, city].filter(Boolean).join(' ') || '台湾' };
      return {
        region: '中国大陆',
        province,
        city,
        location: [province, city].filter(Boolean).join(' ') || '中国大陆（省份待识别）',
      };
    }
    const overseas = normalizeChinaPlaceName(country);
    return { region: overseas || '其他地区', province: overseas, city, location: [overseas, city].filter(Boolean).join(' ') || overseas || '其他地区' };
  } catch (error) {
    ip2RegionError = String(error?.message || error);
    return null;
  }
}

function geoIpStatus() {
  const searcher = getIp2RegionSearcher();
  return {
    enabled: Boolean(searcher),
    provider: 'ip2region',
    mode: 'local-offline',
    error: ip2RegionError,
  };
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
  let region = inferRegion(timezone, language);
  const province = cleanLocationPart(
    body.province ||
    firstHeader(req, [
      'x-geoip-province',
      'x-geo-province',
      'x-ip-province',
      'x-client-province',
      'x-alicdn-province',
      'x-region-name',
      'x-vercel-ip-country-region',
      'cf-ipregion',
    ])
  );
  const city = cleanLocationPart(
    body.city ||
    firstHeader(req, [
      'x-geoip-city',
      'x-geo-city',
      'x-ip-city',
      'x-client-city',
      'x-alicdn-city',
      'x-city-name',
      'x-vercel-ip-city',
      'cf-ipcity',
    ])
  );

  if (province || city) {
    const normalizedProvince = normalizeChinaPlaceName(province);
    const normalizedCity = normalizeChinaPlaceName(city);
    if (['香港', '澳门'].includes(normalizedProvince)) region = `中国${normalizedProvince}`;
    else if (normalizedProvince === '台湾') region = '中国台湾';
    else if (isMainlandProvince(normalizedProvince)) region = '中国大陆';
    else if (region === '其他地区' && normalizedProvince) region = '中国大陆';
    return {
      region,
      province: normalizedProvince,
      city: normalizedCity,
      location: [normalizedProvince, normalizedCity].filter(Boolean).join(' ') || region,
    };
  }

  const ipLocation = lookupLocalIpLocation(clientIp(req));
  if (ipLocation) return ipLocation;

  const tz = String(timezone).toLowerCase();
  if (tz.includes('hong_kong')) return { region: '中国香港', province: '香港', city: '香港', location: '香港' };
  if (tz.includes('taipei')) return { region: '中国台湾', province: '台湾', city: '台北', location: '台湾 台北' };
  if (tz.includes('macau')) return { region: '中国澳门', province: '澳门', city: '澳门', location: '澳门' };
  if (tz.includes('singapore')) return { region: '新加坡', province: '新加坡', city: '新加坡', location: '新加坡' };
  if (tz.includes('chongqing')) return { region: '中国大陆', province: '重庆', city: '重庆', location: '重庆' };
  if (tz.includes('urumqi')) return { region: '中国大陆', province: '新疆', city: '乌鲁木齐', location: '新疆 乌鲁木齐' };

  return { region, province: '', city: '', location: region === '中国大陆' ? '中国大陆（省份待识别）' : region };
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

function displayLocation(event = {}) {
  const location = cleanLocationPart(event.location || '');
  if (location && location !== '中国大陆 未识别') return location;
  const joined = [event.province, event.city].map(cleanLocationPart).filter(Boolean).join(' ');
  if (joined) return joined;
  return event.region === '中国大陆' ? '省份待识别' : (event.region || '未知');
}

function topLocationCounts(events, limit = 12) {
  const counts = new Map();
  for (const event of events) {
    const value = displayLocation(event);
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

function cleanMultilineText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function cleanSlugText(value = '', max = 120) {
  return String(value || '').replace(/[^\w\u4e00-\u9fa5\-/. ]+/g, '').trim().slice(0, max);
}

function cleanAccountId(value = '', max = 80) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, max);
}

function safeFilePart(value = '', max = 90) {
  return String(value || 'file')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'file';
}

function cmsId(prefix = 'cms') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function compactDate() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function leadId() {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function readSitemapUrls() {
  const file = join(process.cwd(), 'sitemap.xml');
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, 'utf8');
  return [...raw.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).filter(Boolean);
}

const CMS_TEAMS = [
  { id: 'aeis', name: 'AEIS 团队', keywords: ['aeis', 's-aeis', 'government-schools', 'primary-schools', 'secondary-schools'] },
  { id: 'o-level', name: 'O-Level 团队', keywords: ['o-level', 'jc', 'poly'] },
  { id: 'wace', name: 'WACE 团队', keywords: ['wace', 'atar'] },
  { id: 'public-university', name: '公立大学团队', keywords: ['university', 'nus', 'ntu', 'smu', 'sutd', 'sit', 'suss', 'uas'] },
  { id: 'private-university', name: '私立大学团队', keywords: ['private-university', 'private-schools', 'kaplan', 'sim', 'psb', 'mdis', 'jcu', 'curtin'] },
  { id: 'international-school', name: '国际学校团队', keywords: ['international-school', 'ib', 'ap'] },
  { id: 'general', name: '综合运营团队', keywords: ['guides', 'pathway', 'news', 'topics', 'tools'] },
];

function pageUrlPath(url = '') {
  try {
    return new URL(url).pathname || '/';
  } catch {
    const value = String(url || '/').trim();
    return value.startsWith('/') ? value : `/${value}`;
  }
}

function inferPageTeam(path = '') {
  const value = String(path || '').toLowerCase();
  for (const team of CMS_TEAMS) {
    if (team.keywords.some((keyword) => value.includes(keyword))) return team.id;
  }
  return 'general';
}

function pageTitleFromPath(path = '') {
  const clean = String(path || '/').replace(/^\/|\/$/g, '');
  if (!clean) return '首页';
  return clean.split('/').filter(Boolean).map((part) => part.replace(/-/g, ' ')).join(' / ');
}

function pageFilePath(path = '') {
  const clean = pageUrlPath(path);
  if (!clean || clean.includes('..')) return null;
  const file = clean === '/' ? join(process.cwd(), 'index.html') : join(process.cwd(), clean.replace(/^\/+/, ''), 'index.html');
  const rel = relative(process.cwd(), file);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return file;
}

function htmlEntityDecode(value = '') {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const number = Number(code);
      return Number.isFinite(number) ? String.fromCharCode(number) : '';
    });
}

function textFromHtml(html = '') {
  return htmlEntityDecode(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function extractPageBlocks(html = '') {
  const main = String(html || '').match(/<main\b[\s\S]*?<\/main>/i)?.[0] || String(html || '');
  const blocks = [];
  const seen = new Set();
  const blockRe = /<(h1|h2|h3|h4|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(main)) && blocks.length < 120) {
    const tag = match[1].toLowerCase();
    const text = textFromHtml(match[2]);
    if (!text || text.length < 2 || text.length > 900) continue;
    const key = `${tag}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({ id: `block_${blocks.length + 1}`, tag, text });
  }
  return blocks;
}

function savedPageRow(path = '') {
  return readJsonl(CMS_PAGES_FILE, 100000).find((row) => pageUrlPath(row.url) === pageUrlPath(path)) || {};
}

function pageRecords() {
  const savedRows = readJsonl(CMS_PAGES_FILE, 100000);
  const saved = new Map(savedRows.map((row) => [pageUrlPath(row.url), row]));
  const sitemapPages = readSitemapUrls().map((url) => {
    const path = pageUrlPath(url);
    const row = saved.get(path) || {};
    return {
      url: path,
      fullUrl: `https://sgeda.org.cn${path}`,
      title: row.title || pageTitleFromPath(path),
      team: row.team || inferPageTeam(path),
      owner: row.owner || '',
      status: row.status || 'todo',
      priority: row.priority || 'normal',
      contentType: row.contentType || (path.includes('/tools/') ? 'tool' : path.split('/').filter(Boolean).length >= 2 ? 'seo-page' : 'pillar'),
      reviewStatus: row.reviewStatus || 'pending',
      imageStatus: row.imageStatus || 'missing',
      imageUrl: row.imageUrl || '',
      imageBrief: row.imageBrief || '',
      aiPrompt: row.aiPrompt || '',
      notes: row.notes || '',
      bodyStatus: row.bodyStatus || '',
      bodyDraftBlocks: Array.isArray(row.bodyDraftBlocks) ? row.bodyDraftBlocks : [],
      bodyNote: row.bodyNote || '',
      bodyUpdatedAt: row.bodyUpdatedAt || '',
      bodyUpdatedBy: row.bodyUpdatedBy || '',
      updatedAt: row.updatedAt || '',
    };
  });
  return sitemapPages.sort((a, b) => a.team.localeCompare(b.team) || a.url.localeCompare(b.url));
}

function cmsUsers() {
  const allowedTeams = new Set(['all', ...CMS_TEAMS.map((team) => team.id)]);
  const rows = [];
  const adminPassword = process.env.CMS_ADMIN_PASSWORD || process.env.REVIEW_ADMIN_TOKEN || '';
  if (adminPassword) {
    rows.push({ username: 'admin', password: adminPassword, role: 'admin', team: 'all', name: '管理员', active: true, source: 'env' });
  }
  if (process.env.CMS_TEAM_ACCOUNTS) {
    try {
      const parsed = JSON.parse(process.env.CMS_TEAM_ACCOUNTS);
      if (Array.isArray(parsed)) rows.push(...parsed.map((row) => ({ ...row, source: 'env' })));
    } catch {
      // Keep legacy password login available if the optional JSON is malformed.
    }
  }
  rows.push(...readJsonl(CMS_USERS_FILE, 10000).map((row) => ({ ...row, source: row.source || 'file' })));
  const byUser = new Map();
  for (const row of rows) {
    const username = cleanAccountId(row.username || row.user);
    const password = String(row.password || '').trim();
    if (!username || !password || row.active === false) continue;
    const team = allowedTeams.has(row.team) ? row.team : 'general';
    byUser.set(username, {
      username,
      password,
      role: ['admin', 'editor', 'reviewer', 'viewer'].includes(row.role) ? row.role : 'editor',
      team,
      name: cleanLeadText(row.name || username, 80),
      source: row.source || 'file',
      active: row.active !== false,
    });
  }
  return [...byUser.values()];
}

function publicCmsUser(user) {
  if (!user) return null;
  return { username: user.username, role: user.role, team: user.team, name: user.name };
}

function authenticateCmsUser(username, password) {
  const inputPassword = String(password || '').trim();
  const inputUsername = cleanAccountId(username || 'admin');
  if (!inputPassword) return null;
  for (const user of cmsUsers()) {
    if (user.username === inputUsername && safeEqual(inputPassword, user.password)) return publicCmsUser(user);
  }
  return null;
}

function pageMatrixSummary(pages = pageRecords()) {
  const byTeam = CMS_TEAMS.map((team) => {
    const items = pages.filter((page) => page.team === team.id);
    return {
      id: team.id,
      name: team.name,
      total: items.length,
      todo: items.filter((page) => page.status === 'todo').length,
      inProgress: items.filter((page) => page.status === 'in_progress').length,
      review: items.filter((page) => page.reviewStatus === 'pending').length,
      missingImages: items.filter((page) => page.imageStatus === 'missing').length,
    };
  });
  return {
    teams: CMS_TEAMS.map(({ id, name }) => ({ id, name })),
    total: pages.length,
    todo: pages.filter((page) => page.status === 'todo').length,
    inProgress: pages.filter((page) => page.status === 'in_progress').length,
    ready: pages.filter((page) => page.status === 'ready').length,
    missingImages: pages.filter((page) => page.imageStatus === 'missing').length,
    byTeam,
  };
}

function countArticlesByDate(date) {
  const articleDir = join(process.cwd(), 'content', 'articles');
  if (!existsSync(articleDir)) return 0;
  let count = 0;
  for (const file of readdirSync(articleDir).filter((item) => item.endsWith('.md') && !item.startsWith('_'))) {
    const raw = readFileSync(join(articleDir, file), 'utf8');
    const { meta } = parseFrontmatter(raw);
    if (String(meta.date || meta.publishedAt || '').startsWith(date) && !meta.draft) count += 1;
  }
  return count;
}

function readBaiduSubmitState(totalUrls) {
  const offsetFile = join(process.cwd(), '.baidu-submit-offset');
  const offset = existsSync(offsetFile) ? Number(readFileSync(offsetFile, 'utf8').trim()) || 0 : 0;
  let logTail = [];
  for (const file of ['/var/log/baidu-submit.log', join(process.cwd(), 'baidu-submit.log')]) {
    if (!existsSync(file)) continue;
    logTail = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).slice(-10);
    break;
  }
  return {
    offset,
    nextStart: totalUrls ? Math.min(offset + 1, totalUrls) : 0,
    logTail,
  };
}

function submissionSummary(date = todayDate()) {
  const records = readJsonl(SEO_SUBMISSION_FILE, 5000)
    .filter((row) => row.date === date || String(row.createdAt || '').startsWith(date))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const providers = {
    baidu: { submitted: 0, success: 0, error: 0, lastStatus: '', lastHttpStatus: 0 },
    indexnow: { submitted: 0, success: 0, error: 0, lastStatus: '', lastHttpStatus: 0 },
  };
  for (const record of records) {
    const provider = String(record.provider || '').toLowerCase();
    if (!providers[provider]) continue;
    providers[provider].submitted += Math.max(0, Number(record.submitted || 0) || 0);
    if (record.status === 'success') providers[provider].success += 1;
    if (record.status && record.status !== 'success') providers[provider].error += 1;
    if (!providers[provider].lastStatus) {
      providers[provider].lastStatus = record.status || '';
      providers[provider].lastHttpStatus = Number(record.httpStatus || 0) || 0;
    }
  }
  return {
    records: records.slice(0, 20),
    providers,
    totalSubmitted: Object.values(providers).reduce((sum, item) => sum + item.submitted, 0),
  };
}

function latestSeoRecord(date) {
  return readJsonl(SEO_DAILY_FILE, 100000).reverse().find((row) => row.date === date) || null;
}

function seoSnapshot(date = todayDate()) {
  const sitemapUrls = readSitemapUrls();
  const baidu = readBaiduSubmitState(sitemapUrls.length);
  const saved = latestSeoRecord(date);
  const audit = seoContentAudit(sitemapUrls);
  const submissions = submissionSummary(date);
  return {
    date,
    sitemapUrlCount: sitemapUrls.length,
    todayPublishedArticles: countArticlesByDate(date),
    baiduOffset: baidu.offset,
    baiduNextStart: baidu.nextStart,
    baiduLogTail: baidu.logTail,
    submissions,
    saved,
    audit,
    recent: readJsonl(SEO_DAILY_FILE, 60).reverse(),
  };
}

function stripMarkdown(markdown = '') {
  return String(markdown || '')
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentLength(markdown = '') {
  return stripMarkdown(markdown).replace(/\s/g, '').length;
}

function markdownInternalLinks(markdown = '') {
  return [...String(markdown || '').matchAll(/\[[^\]]+]\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

function htmlInternalLinks(html = '') {
  const text = String(html || '');
  const content = text.match(/<article\b[^>]*class=["'][^"']*\bcontent-body\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || text;
  return [...content.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)]
    .map((match) => match[1].trim())
    .filter((href) => href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/#'));
}

function hasFaqSection(markdown = '') {
  const text = String(markdown || '');
  return /(^|\n)#{2,4}\s*(FAQ|常见问题|家长常问|常见问答)/i.test(text) || /[？?]\s*(\n|$)/.test(text);
}

function auditLevel(issues) {
  if (issues.some((item) => item.severity === 'error')) return 'error';
  if (issues.some((item) => item.severity === 'warning')) return 'warning';
  return 'pass';
}

function addIssue(issues, severity, message) {
  issues.push({ severity, message });
}

function auditArticle(fullPath, sitemapSet) {
  const raw = readFileSync(fullPath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const file = relativeArticlePath(fullPath);
  const urlPath = makeArticleUrl(meta);
  const absoluteUrl = `https://sgeda.org.cn${urlPath}`;
  const htmlPath = join(process.cwd(), urlPath.replace(/^\/+/, ''), 'index.html');
  const htmlExists = existsSync(htmlPath);
  const html = htmlExists ? readFileSync(htmlPath, 'utf8') : '';
  const issues = [];
  const title = cleanLeadText(meta.title, 200);
  const description = cleanLeadText(meta.description, 240);
  const keywords = cleanLeadText(meta.keywords || meta.tags, 300);
  const length = contentLength(body);
  const internalLinks = markdownInternalLinks(body);
  const pageInternalLinks = htmlInternalLinks(html);
  const internalLinkCount = Math.max(internalLinks.length, pageInternalLinks.length);
  const h2Count = (body.match(/^##\s+/gm) || []).length;
  const hasFaq = hasFaqSection(body);
  const hasArticleSchema = /"@type"\s*:\s*"Article"/.test(html);
  const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/.test(html);
  const optimization = optimizeArticle({ meta, body, html, htmlExists, inSitemap: sitemapSet.has(absoluteUrl) });

  if (!title) addIssue(issues, 'error', '缺少 title');
  else if (title.length < 18) addIssue(issues, 'warning', '标题偏短，长尾词表达可能不够完整');
  else if (title.length > 42) addIssue(issues, 'warning', '标题偏长，搜索结果可能被截断');

  if (!description) addIssue(issues, 'error', '缺少 description');
  else if (description.length < 50) addIssue(issues, 'warning', 'description 偏短，建议 50-110 字');
  else if (description.length > 120) addIssue(issues, 'warning', 'description 偏长，建议控制在 120 字内');

  if (!meta.slug) addIssue(issues, 'error', '缺少 slug，URL 不稳定');
  if (!meta.category) addIssue(issues, 'error', '缺少 category，栏目归属不清晰');
  if (!meta.date) addIssue(issues, 'warning', '缺少 date，文章时效信号不足');
  if (!keywords) addIssue(issues, 'warning', '缺少 keywords/tags，后台选题归档不完整');
  if (meta.draft) addIssue(issues, 'warning', '文章仍是 draft，不会作为正式页面收录');

  if (length < 1500) addIssue(issues, 'warning', `正文偏短（约 ${length} 字），建议 1500 字以上`);
  if (length > 4200) addIssue(issues, 'warning', `正文偏长（约 ${length} 字），建议拆成子话题或加强目录`);
  if (h2Count < 4) addIssue(issues, 'warning', 'H2 小标题偏少，长文结构不够清晰');
  if (!hasFaq) addIssue(issues, 'warning', '缺少 FAQ/常见问题段落，GEO 摘要机会偏弱');
  if (internalLinkCount < 2) addIssue(issues, 'warning', '站内内链偏少，建议至少 2-4 个相关页面');

  if (!meta.draft && !htmlExists) addIssue(issues, 'error', '已发布但生成页面不存在，请重新构建内容');
  if (!meta.draft && !sitemapSet.has(absoluteUrl)) addIssue(issues, 'error', '已发布但未进入 sitemap');
  if (!meta.draft && htmlExists && !hasArticleSchema) addIssue(issues, 'error', '生成页缺少 Article schema');
  if (!meta.draft && htmlExists && hasFaq && !hasFaqSchema) addIssue(issues, 'warning', '正文有 FAQ 倾向，但页面未输出 FAQ schema');
  const mergedIssues = [...issues, ...optimization.issues.filter((issue) => !issues.some((item) => item.message === issue.message))];
  const mergedLevel = auditLevel(mergedIssues);
  const mergedScore = Math.max(0, 100 - mergedIssues.reduce((sum, issue) => sum + (issue.severity === 'error' ? 22 : 8), 0));

  return {
    file,
    title: title || basename(fullPath),
    url: absoluteUrl,
    category: meta.categoryLabel || meta.category || 'SEO文章',
    draft: Boolean(meta.draft),
    level: mergedLevel,
    score: mergedScore,
    length,
    h2Count,
    internalLinkCount,
    contentInternalLinkCount: internalLinks.length,
    pageInternalLinkCount: pageInternalLinks.length,
    hasFaq,
    hasArticleSchema,
    hasFaqSchema,
    inSitemap: sitemapSet.has(absoluteUrl),
    imageCount: optimization.metrics.imageCount,
    faqCount: optimization.metrics.faqCount,
    recommendedPublish: optimization.recommendedPublish,
    imagePlan: optimization.imagePlan,
    suggestions: optimization.suggestions,
    issues: mergedIssues,
  };
}

function seoContentAudit(sitemapUrls = readSitemapUrls()) {
  const articleDir = join(process.cwd(), 'content', 'articles');
  const sitemapSet = new Set(sitemapUrls);
  if (!existsSync(articleDir)) return { totals: { articles: 0, pass: 0, warning: 0, error: 0, averageScore: 0 }, items: [] };
  const items = readdirSync(articleDir)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => auditArticle(join(articleDir, file), sitemapSet))
    .sort((a, b) => {
      const rank = { error: 0, warning: 1, pass: 2 };
      return rank[a.level] - rank[b.level] || a.score - b.score || a.title.localeCompare(b.title);
    });
  const totals = {
    articles: items.length,
    pass: items.filter((item) => item.level === 'pass').length,
    warning: items.filter((item) => item.level === 'warning').length,
    error: items.filter((item) => item.level === 'error').length,
    averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0,
  };
  return { totals, items: items.slice(0, 80) };
}

function articleSummaries() {
  const articleDir = join(process.cwd(), 'content', 'articles');
  if (!existsSync(articleDir)) return [];
  return readdirSync(articleDir)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => {
      const fullPath = join(articleDir, file);
      const raw = readFileSync(fullPath, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const optimization = optimizeArticle({ meta, body });
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
        seoScore: optimization.score,
        seoLevel: optimization.level,
        seoRecommendedPublish: optimization.recommendedPublish,
        seoSuggestions: optimization.suggestions,
        imagePlan: optimization.imagePlan,
      };
    })
    .sort((a, b) => Number(b.draft) - Number(a.draft) || String(b.date).localeCompare(String(a.date)));
}

function contentIdeasFromArticles(articles) {
  const text = articles.map((item) => `${item.title} ${item.slug}`).join('\n').toLowerCase();
  const ideas = [
    { keyword: 'WACE EALD', title: 'WACE EALD 对中国学生重要吗？' },
    { keyword: 'WACE Specialist', title: 'WACE Specialist Mathematics 怎么选？' },
    { keyword: 'WACE Methods', title: 'WACE Methods 适合什么学生？' },
    { keyword: 'O-Level JC', title: 'O-Level 申请 JC 需要什么成绩？' },
    { keyword: 'O-Level Poly', title: 'O-Level 申请 Poly 完整路径' },
    { keyword: 'AEIS 年龄', title: 'AEIS 年龄要求与插班年级怎么判断？' },
    { keyword: '新加坡国际学校费用', title: '新加坡国际学校一年多少钱？' },
    { keyword: 'NUS 申请', title: '中国学生申请 NUS 本科需要准备什么？' },
  ];
  return ideas
    .filter((idea) => !text.includes(idea.keyword.toLowerCase()) && !text.includes(idea.title.toLowerCase()))
    .slice(0, 6);
}

const SEO_TOPICS = [
  { slug: 'aeis', name: 'AEIS 专题', keywords: ['aeis', 's-aeis', '政府学校', '插班'] },
  { slug: 'o-level', name: 'O-Level 专题', keywords: ['o-level', 'o水准', 'jc', 'poly'] },
  { slug: 'wace', name: 'WACE 专题', keywords: ['wace', 'atar', 'eald', 'methods'] },
  { slug: 'singapore-government-schools', name: '政府学校专题', keywords: ['政府学校', '政府小学', '政府中学', 'aeis'] },
  { slug: 'international-schools', name: '国际学校专题', keywords: ['国际学校', 'ib', 'igcse', '学费'] },
  { slug: 'singapore-university', name: '大学申请专题', keywords: ['大学', 'nus', 'ntu', 'smu', '本科申请'] },
  { slug: 'study-cost', name: '留学费用专题', keywords: ['费用', '学费', '预算', '住宿'] },
];

function topicMatrix(articles = articleSummaries(), sitemapUrls = readSitemapUrls()) {
  const sitemapSet = new Set(sitemapUrls);
  return SEO_TOPICS.map((topic) => {
    const textMatch = articles.filter((article) => {
      const text = [article.title, article.description, article.category, article.slug].join(' ').toLowerCase();
      return topic.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    });
    const url = `/topics/${topic.slug}/`;
    const absoluteUrl = `https://sgeda.org.cn${url}`;
    return {
      ...topic,
      url,
      exists: existsSync(join(process.cwd(), 'topics', topic.slug, 'index.html')),
      inSitemap: sitemapSet.has(absoluteUrl),
      articleCount: textMatch.length,
      publishedCount: textMatch.filter((article) => !article.draft).length,
      draftCount: textMatch.filter((article) => article.draft).length,
    };
  });
}

function contentHealth(articles = articleSummaries()) {
  const lowScore = articles.filter((article) => (article.seoScore || 0) < 70);
  const noImagePlan = articles.filter((article) => !article.imagePlan?.heroFilename);
  const drafts = articles.filter((article) => article.draft);
  const published = articles.filter((article) => !article.draft);
  return {
    total: articles.length,
    published: published.length,
    draft: drafts.length,
    lowScore: lowScore.length,
    averageScore: articles.length ? Math.round(articles.reduce((sum, article) => sum + (article.seoScore || 0), 0) / articles.length) : 0,
    missingImagePlan: noImagePlan.length,
    needsAction: lowScore.slice(0, 8).map((article) => ({
      title: article.title,
      score: article.seoScore || 0,
      file: article.file,
      draft: article.draft,
    })),
  };
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
  const eventType = cleanLeadText(body.eventType || 'pageview', 40);
  const durationSeconds = Math.max(0, Math.min(Number(body.durationSeconds || 0) || 0, 86400));
  const timezone = String(body.timezone || '').slice(0, 80);
  const language = String(body.language || req.headers['accept-language'] || '').slice(0, 120);
  const visitorRaw = body.visitorId || `${clientIp(req)}:${req.headers['user-agent'] || ''}`;
  const location = inferLocation(req, body, timezone, language);
  const event = {
    ts: new Date().toISOString(),
    eventType,
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
    durationSeconds,
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

function handleCmsSeo(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const date = cleanLeadText(url.searchParams.get('date') || todayDate(), 20) || todayDate();
  json(res, 200, { ok: true, ...seoSnapshot(date) });
}

async function handleCmsSeoSave(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const date = cleanLeadText(body.date || todayDate(), 20) || todayDate();
  const snapshot = seoSnapshot(date);
  const record = {
    date,
    updatedAt: new Date().toISOString(),
    sitemapUrlCount: snapshot.sitemapUrlCount,
    todayPublishedArticles: snapshot.todayPublishedArticles,
    baiduSubmitted: Math.max(0, Number(body.baiduSubmitted || snapshot.submissions?.providers?.baidu?.submitted || 0) || 0),
    indexNowSubmitted: Math.max(0, Number(body.indexNowSubmitted || snapshot.submissions?.providers?.indexnow?.submitted || 0) || 0),
    baiduRemaining: Math.max(0, Number(body.baiduRemaining || 0) || 0),
    indexedCount: Math.max(0, Number(body.indexedCount || 0) || 0),
    abnormalUrlCount: Math.max(0, Number(body.abnormalUrlCount || 0) || 0),
    priorityUrls: cleanMultilineText(body.priorityUrls, 1200),
    notes: cleanMultilineText(body.notes, 1200),
  };
  const rows = readJsonl(SEO_DAILY_FILE, 100000).filter((row) => row.date !== date);
  rows.push(record);
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  writeJsonl(SEO_DAILY_FILE, rows);
  json(res, 200, { ok: true, record, ...seoSnapshot(date) });
}

function handleCmsAnalytics(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30), 1), 90);
  const recentLimit = Math.min(Math.max(Number(url.searchParams.get('recentLimit') || 20), 1), 100);
  const recentOffset = Math.min(Math.max(Number(url.searchParams.get('recentOffset') || 0), 0), 5000);
  const events = readAnalyticsEvents(days);
  const pageviews = events.filter((event) => (event.eventType || 'pageview') === 'pageview');
  const engagementEvents = events.filter((event) => event.eventType === 'engagement' && Number(event.durationSeconds || 0) > 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEvents = pageviews.filter((event) => String(event.ts).startsWith(todayKey));
  const visitors = new Set(pageviews.map((event) => event.visitor)).size;
  const todayVisitors = new Set(todayEvents.map((event) => event.visitor)).size;
  const averageDurationSeconds = engagementEvents.length
    ? Math.round(engagementEvents.reduce((sum, event) => sum + (Number(event.durationSeconds || 0) || 0), 0) / engagementEvents.length)
    : 0;
  const recentAll = pageviews.slice().reverse();
  const recent = recentAll.slice(recentOffset, recentOffset + recentLimit).map((event) => ({
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
    recentPaging: {
      offset: recentOffset,
      limit: recentLimit,
      total: recentAll.length,
      returned: recent.length,
      hasMore: recentOffset + recent.length < recentAll.length,
      nextOffset: recentOffset + recent.length,
    },
    totals: {
      pageviews: events.length,
      pageviewEvents: pageviews.length,
      visitors,
      todayPageviews: todayEvents.length,
      todayVisitors,
      averageDurationSeconds,
    },
    regions: topCounts(pageviews, 'region', 12),
    locations: topLocationCounts(pageviews, 12),
    provinces: topCounts(pageviews, 'province', 12),
    pages: topCounts(pageviews, 'path', 12),
    sources: topCounts(pageviews, 'source', 10),
    devices: topCounts(pageviews, 'device', 6),
    recent: recent.map((event) => ({ ...event, location: displayLocation(event) })),
  });
}

function handleCmsOverview(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const today = todayDate();
  const articles = articleSummaries();
  const leads = readJsonl(LEADS_FILE, 100000);
  const events = readAnalyticsEvents(30).filter((event) => (event.eventType || 'pageview') === 'pageview');
  const todayEvents = events.filter((event) => String(event.ts || '').startsWith(today));
  const seo = seoSnapshot(today);
  const topics = topicMatrix(articles, readSitemapUrls());
  const health = contentHealth(articles);
  const draftArticles = articles.filter((item) => item.draft && item.reviewStatus !== 'needs_revision');
  const revisionArticles = articles.filter((item) => item.reviewStatus === 'needs_revision');
  const publishedArticles = articles.filter((item) => !item.draft);
  const todayPublished = publishedArticles.filter((item) => String(item.date || item.publishedAt || '').startsWith(today));
  const newLeads = leads.filter((lead) => (lead.status || 'new') === 'new');
  const pendingCrm = leads.filter((lead) => (lead.crmStatus || 'pending') === 'pending');
  const todayLeads = leads.filter((lead) => String(lead.createdAt || '').startsWith(today));
  const tasks = [];
  if (draftArticles.length) tasks.push({ type: 'content', title: `审核 ${draftArticles.length} 篇 SEO 草稿`, target: 'content', priority: 'high' });
  if (revisionArticles.length) tasks.push({ type: 'content', title: `${revisionArticles.length} 篇文章需要修改`, target: 'content', priority: 'medium' });
  if (newLeads.length) tasks.push({ type: 'leads', title: `跟进 ${newLeads.length} 条新客户线索`, target: 'leads', priority: 'high' });
  if (pendingCrm.length) tasks.push({ type: 'leads', title: `${pendingCrm.length} 条线索待同步 CRM`, target: 'leads', priority: 'medium' });
  if (todayPublished.length < 5) tasks.push({ type: 'content', title: `今日已发布 ${todayPublished.length} 篇，建议补到 5 篇以上`, target: 'content', priority: 'medium' });
  if (!seo.saved) tasks.push({ type: 'seo', title: '记录今日百度 / IndexNow 提交情况', target: 'seo', priority: 'medium' });
  if (topics.some((topic) => !topic.inSitemap)) tasks.push({ type: 'seo', title: '检查专题页是否全部进入 sitemap', target: 'seo', priority: 'medium' });
  if (health.lowScore) tasks.push({ type: 'content', title: `${health.lowScore} 篇内容 SEO 分数低于 70`, target: 'seo', priority: 'medium' });
  json(res, 200, {
    ok: true,
    date: today,
    metrics: {
      totalArticles: articles.length,
      draftArticles: draftArticles.length,
      publishedArticles: publishedArticles.length,
      todayPublished: todayPublished.length,
      totalLeads: leads.length,
      newLeads: newLeads.length,
      todayLeads: todayLeads.length,
      pageviews30d: events.length,
      visitors30d: new Set(events.map((event) => event.visitor)).size,
      todayPageviews: todayEvents.length,
      sitemapUrlCount: seo.sitemapUrlCount,
      baiduNextStart: seo.baiduNextStart,
      indexNowSubmitted: seo.submissions?.providers?.indexnow?.submitted || 0,
      baiduSubmitted: seo.submissions?.providers?.baidu?.submitted || 0,
      contentAverageScore: health.averageScore,
    },
    tasks,
    topicMatrix: topics,
    contentHealth: health,
    seoOps: {
      sitemapUrlCount: seo.sitemapUrlCount,
      baiduNextStart: seo.baiduNextStart,
      baiduSubmitted: seo.submissions?.providers?.baidu?.submitted || 0,
      indexNowSubmitted: seo.submissions?.providers?.indexnow?.submitted || 0,
      baiduStatus: seo.submissions?.providers?.baidu?.lastStatus || '',
      indexNowStatus: seo.submissions?.providers?.indexnow?.lastStatus || '',
      auditTotals: seo.audit?.totals || {},
      saved: Boolean(seo.saved),
    },
    contentIdeas: contentIdeasFromArticles(articles),
    recentArticles: articles.slice(0, 8),
    recentLeads: leads.slice(-6).reverse(),
    topPages: topCounts(events, 'path', 8),
    topSources: topCounts(events, 'source', 6),
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

function svgEscape(value = '') {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function titleLines(title = '', maxChars = 16, maxLines = 3) {
  const text = cleanLeadText(title, 120);
  const lines = [];
  let cursor = '';
  for (const char of text) {
    cursor += char;
    if (cursor.length >= maxChars) {
      lines.push(cursor);
      cursor = '';
      if (lines.length >= maxLines) break;
    }
  }
  if (cursor && lines.length < maxLines) lines.push(cursor);
  return lines.length ? lines : ['SEDA 新加坡择校网'];
}

function articleCoverSvg({ title, category, alt }) {
  const lines = titleLines(title);
  const categoryText = cleanLeadText(category || '新加坡升学', 40);
  const altText = cleanLeadText(alt || title || 'SEDA 新加坡择校网配图', 120);
  const lineNodes = lines.map((line, index) => `<text x="82" y="${210 + index * 58}" class="title">${svgEscape(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${svgEscape(altText)}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#fff7f7"/>
      <stop offset="0.58" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3f6fb"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#172033" flood-opacity=".13"/>
    </filter>
    <style>
      .brand{font:800 30px Arial, "Noto Sans SC", sans-serif;fill:#cf2029;letter-spacing:2px}
      .eyebrow{font:800 26px Arial, "Noto Sans SC", sans-serif;fill:#cf2029}
      .title{font:900 48px Arial, "Noto Sans SC", sans-serif;fill:#172033}
      .meta{font:700 24px Arial, "Noto Sans SC", sans-serif;fill:#667085}
      .label{font:800 22px Arial, "Noto Sans SC", sans-serif;fill:#ffffff}
    </style>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect x="52" y="52" width="1096" height="571" rx="34" fill="#fff" filter="url(#shadow)"/>
  <rect x="52" y="52" width="1096" height="571" rx="34" fill="none" stroke="#f1c9cd" stroke-width="2"/>
  <text x="82" y="112" class="brand">SEDA 新加坡择校网</text>
  <rect x="82" y="136" width="174" height="42" rx="21" fill="#cf2029"/>
  <text x="112" y="164" class="label">${svgEscape(categoryText)}</text>
  ${lineNodes}
  <text x="82" y="438" class="meta">面向中国家长的新加坡升学规划指南</text>
  <g transform="translate(770 152)">
    <rect width="286" height="318" rx="24" fill="#fff7f7" stroke="#f3c5c8" stroke-width="2"/>
    <path d="M54 224h178" stroke="#cf2029" stroke-width="10" stroke-linecap="round"/>
    <path d="M74 188h138" stroke="#cf2029" stroke-width="10" stroke-linecap="round" opacity=".82"/>
    <path d="M94 152h98" stroke="#cf2029" stroke-width="10" stroke-linecap="round" opacity=".66"/>
    <circle cx="144" cy="82" r="42" fill="#cf2029"/>
    <path d="M122 83l15 15 31-38" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="82" y="558" class="meta">AEIS · O-Level · WACE · 国际学校 · 大学申请</text>
</svg>`;
}

function insertHeroImageMarkdown(raw, markdown) {
  if (String(raw || '').includes(markdown)) return raw;
  const match = String(raw || '').match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!match) return `${markdown}\n\n${raw}`;
  const body = match[2].replace(/^\s+/, '');
  if (/^!\[[^\]]*]\([^)]+\)/.test(body)) return `${match[1]}${markdown}\n\n${body}`;
  return `${match[1]}\n${markdown}\n\n${body}`;
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

function submitSeoAfterPublish() {
  return new Promise((resolve) => {
    execFile('npm', ['run', 'seo:submit'], { cwd: process.cwd(), timeout: 90000 }, (error, stdout, stderr) => {
      const output = `${stdout || ''}${stderr || ''}`;
      resolve({
        ok: !error,
        output,
        error: error ? error.message : '',
      });
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
  if (!authSecret()) return json(res, 503, { error: 'CMS 登录密钥未配置' });
  const user = authenticateCmsUser(body.username || 'admin', body.password);
  if (!user) return json(res, 401, { error: '账号或密码错误' });
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': createSessionCookie(user),
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ ok: true, user }));
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
  json(res, 200, { ok: true, articles: articleSummaries() });
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
  const { meta, body } = parseFrontmatter(raw);
  const optimization = optimizeArticle({ meta, body });
  json(res, 200, { ok: true, file: relativeArticlePath(fullPath), meta, content: raw, optimization });
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

async function handleCmsArticleImage(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const fullPath = articleFilePath(body.file);
  if (!fullPath || !existsSync(fullPath)) return json(res, 404, { error: '文章不存在' });
  const raw = readFileSync(fullPath, 'utf8');
  const { meta, body: articleBody } = parseFrontmatter(raw);
  const optimization = optimizeArticle({ meta, body: articleBody });
  const plan = optimization.imagePlan || {};
  const filename = `${safeFilePart(plan.heroFilename || meta.slug || basename(fullPath), 120)}.svg`;
  mkdirSync(CMS_MEDIA_DIR, { recursive: true });
  const filePath = join(CMS_MEDIA_DIR, filename);
  const category = cleanLeadText(meta.categoryLabel || meta.category || '新加坡升学', 40);
  const alt = cleanLeadText(plan.heroAlt || meta.title || 'SEDA 新加坡择校网文章配图', 160);
  writeFileSync(filePath, articleCoverSvg({ title: meta.title || basename(fullPath), category, alt }), 'utf8');
  const url = mediaUrlFor(filename);
  const markdown = `![${alt}](${url})`;
  const insert = body.insert !== false;
  let output = null;
  if (insert && !raw.includes(url)) {
    writeFileSync(fullPath, insertHeroImageMarkdown(raw, markdown), 'utf8');
    try {
      output = await rebuildContent();
    } catch (error) {
      return json(res, 500, { error: '图片已生成，但内容构建失败', detail: error.output || error.message, url, markdown });
    }
  }
  const session = cmsSession(req) || {};
  mkdirSync(dirname(CMS_MEDIA_FILE), { recursive: true });
  appendFileSync(CMS_MEDIA_FILE, `${JSON.stringify({
    id: cmsId('media'),
    filename,
    url,
    mime: 'image/svg+xml',
    size: readFileSync(filePath).length,
    alt,
    team: inferPageTeam(`/${meta.category || 'guides'}/`),
    pageUrl: makeArticleUrl(meta),
    tags: cleanLeadText([meta.category, meta.primaryKeyword, meta.title].filter(Boolean).join(', '), 240),
    uploadedBy: session.username || 'admin',
    createdAt: new Date().toISOString(),
    generatedBy: 'cms-seo-cover',
  })}\n`, 'utf8');
  json(res, 200, { ok: true, url, markdown, alt, filename, inserted: insert, output });
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
    let seoSubmission = null;
    if (action === 'approve') {
      seoSubmission = await submitSeoAfterPublish();
    }
    json(res, 200, { ok: true, action, output, seoSubmission });
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
    wechatId: process.env.WECHAT_ID || 'SEDAGUIDE',
    wechatQrUrl: process.env.WECHAT_QR_URL || '/assets/wechat-amy-seda-guide.jpg',
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || process.env.GA_MEASUREMENT_ID || DEFAULT_GOOGLE_ANALYTICS_ID,
  });
}

function handleCmsGeoDebug(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const headerNames = [
    'x-forwarded-for',
    'x-real-ip',
    'x-geoip-province',
    'x-geo-province',
    'x-ip-province',
    'x-client-province',
    'x-alicdn-province',
    'x-region-name',
    'x-geoip-city',
    'x-geo-city',
    'x-ip-city',
    'x-client-city',
    'x-alicdn-city',
    'x-city-name',
  ];
  const headers = {};
  for (const name of headerNames) {
    if (req.headers[name]) headers[name] = String(req.headers[name]).slice(0, 160);
  }
  const timezone = cleanLeadText(req.headers['x-debug-timezone'] || 'Asia/Shanghai', 80);
  const language = cleanLeadText(req.headers['accept-language'] || 'zh-CN', 120);
  const location = inferLocation(req, {}, timezone, language);
  const ip = clientIp(req);
  json(res, 200, {
    ok: true,
    clientIp: ip,
    receivedGeoHeaders: headers,
    localGeoIp: {
      ...geoIpStatus(),
      sample: lookupLocalIpLocation(ip),
    },
    inferredLocation: location,
    expectedHeaders: ['x-alicdn-province', 'x-alicdn-city'],
  });
}

function handleCmsPages(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req) || {};
  const team = String(url.searchParams.get('team') || '').trim();
  const status = String(url.searchParams.get('status') || '').trim();
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  let pages = pageRecords();
  if (session.team && session.team !== 'all') pages = pages.filter((page) => page.team === session.team);
  if (team && team !== 'all') pages = pages.filter((page) => page.team === team);
  if (status && status !== 'all') pages = pages.filter((page) => page.status === status || page.reviewStatus === status || page.imageStatus === status);
  if (q) {
    pages = pages.filter((page) => [page.url, page.title, page.owner, page.notes, page.aiPrompt].join(' ').toLowerCase().includes(q));
  }
  json(res, 200, { ok: true, summary: pageMatrixSummary(pageRecords()), pages: pages.slice(0, 800) });
}

function handleCmsUsers(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req);
  if (session.role !== 'admin') return json(res, 403, { error: '只有管理员可以查看账号列表' });
  const users = cmsUsers().map((user) => ({
    username: user.username,
    role: user.role,
    team: user.team,
    name: user.name,
    source: user.source,
    active: user.active,
  }));
  json(res, 200, { ok: true, users, teams: CMS_TEAMS.map(({ id, name }) => ({ id, name })) });
}

async function handleCmsUserSave(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req);
  if (session.role !== 'admin') return json(res, 403, { error: '只有管理员可以维护账号' });
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const username = cleanAccountId(body.username);
  const password = String(body.password || '').trim();
  if (!username || !password) return json(res, 400, { error: '请输入账号和密码' });
  const allowedTeams = new Set(['all', ...CMS_TEAMS.map((team) => team.id)]);
  const rows = readJsonl(CMS_USERS_FILE, 10000).filter((row) => cleanAccountId(row.username) !== username);
  rows.push({
    username,
    password,
    role: ['admin', 'editor', 'reviewer', 'viewer'].includes(body.role) ? body.role : 'editor',
    team: allowedTeams.has(body.team) ? body.team : 'general',
    name: cleanLeadText(body.name || username, 80),
    active: body.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  writeJsonl(CMS_USERS_FILE, rows);
  json(res, 200, { ok: true, users: cmsUsers().map(publicCmsUser) });
}

function mediaUrlFor(filename) {
  return `/assets/uploads/cms/${filename}`;
}

function handleCmsMediaList(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const team = String(url.searchParams.get('team') || '').trim();
  let media = readJsonl(CMS_MEDIA_FILE, 5000).reverse();
  if (team && team !== 'all') media = media.filter((item) => item.team === team);
  json(res, 200, { ok: true, media: media.slice(0, 300), teams: CMS_TEAMS.map(({ id, name }) => ({ id, name })) });
}

async function handleCmsMediaUpload(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误或图片过大' }); }
  const match = String(body.dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return json(res, 400, { error: '只支持 PNG/JPG/WebP/SVG 图片上传' });
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2.5 * 1024 * 1024) return json(res, 400, { error: '图片请控制在 2.5MB 以内' });
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1];
  const base = safeFilePart(body.filename || body.alt || 'cms-image');
  const filename = `${compactDate()}-${base}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  mkdirSync(CMS_MEDIA_DIR, { recursive: true });
  writeFileSync(join(CMS_MEDIA_DIR, filename), buffer);
  const session = cmsSession(req) || {};
  const allowedTeams = new Set(CMS_TEAMS.map((team) => team.id));
  const record = {
    id: cmsId('media'),
    filename,
    url: mediaUrlFor(filename),
    mime,
    size: buffer.length,
    alt: cleanLeadText(body.alt || 'SEDA 新加坡择校网配图', 160),
    team: allowedTeams.has(body.team) ? body.team : (session.team === 'all' ? 'general' : session.team || 'general'),
    pageUrl: cleanLeadText(body.pageUrl, 240),
    tags: cleanLeadText(body.tags, 240),
    uploadedBy: session.username || 'admin',
    createdAt: new Date().toISOString(),
  };
  mkdirSync(dirname(CMS_MEDIA_FILE), { recursive: true });
  appendFileSync(CMS_MEDIA_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  json(res, 200, { ok: true, media: record });
}

function seoSlug(value = '') {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (/^[\u4e00-\u9fa5-]+$/.test(raw)) return `seo-${Date.now().toString(36)}`;
  return raw.slice(0, 80) || `seo-${Date.now().toString(36)}`;
}

function uniqueArticleSlug(topic) {
  const dir = join(process.cwd(), 'content', 'articles');
  const base = seoSlug(topic);
  let slug = base;
  let index = 2;
  while (existsSync(join(dir, `${slug}.md`))) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function quotedYaml(value = '') {
  return `"${String(value || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"')}"`;
}

function fallbackAiArticle({ topic, category, targetUrl }) {
  const title = cleanLeadText(topic, 90);
  return `# ${title}

很多中国家长第一次搜索“${title}”时，真正想解决的不是概念问题，而是想判断这条路径是否适合自己的孩子。SEDA 建议先把年龄、英文基础、目标学校类型和家庭预算放在一起看，再决定是否进入申请或备考阶段。

## 适合哪些学生

如果孩子希望在新加坡继续升学，且家庭希望有清晰的课程路径、考试节点和学校选择，那么这个方向值得重点评估。不同学生的情况差异很大，不能只看单一考试成绩。

## 家长需要先确认什么

建议先确认当前年级、英文水平、数学基础、目标学校类型和可接受的准备周期。对于国际学生来说，时间线经常比成绩本身更重要。

## 申请或备考重点

准备阶段应优先解决三件事：第一是明确目标路径，第二是判断差距，第三是安排备考或申请材料。不要等到临近截止日期才开始整理资料。

## 和其他路径怎么比较

可以同时比较 AEIS、O-Level、WACE、A-Level、Poly、公立大学和国际学校路径。不同路径的适配人群、英语要求和升学出口不同，家长应避免只听单一学校或单一课程的说法。

## SEDA 建议

如果还没有明确方向，可以先阅读 ${targetUrl || '/'} 相关页面，再结合孩子当前情况做一次路径筛选。真正好的规划不是选最热门的学校，而是选孩子能够持续推进的路径。

## 常见问题

### 这个方向适合中国学生吗？

适合一部分学生，但需要结合年龄、英文水平、目标大学或学校类型判断。

### 需要提前多久准备？

通常建议至少提前 6-12 个月做规划，热门学校和关键考试路径需要更早。

### 家长下一步应该做什么？

先整理孩子年级、成绩、英文水平和目标，再让顾问判断更稳妥的路径。`;
}

async function generateAiArticle(body) {
  const topic = cleanLeadText(body.topic, 120);
  if (!topic) throw new Error('请输入文章主题');
  const category = cleanAccountId(body.category || 'guides', 60) || 'guides';
  const slug = uniqueArticleSlug(topic);
  const targetUrl = pageUrlPath(body.targetUrl || `/${category}/`);
  const prompt = cleanMultilineText(body.prompt, 1800);
  const system = '你是 SEDA 新加坡择校网的中文 SEO 编辑。写给中国家长，语气自然，不要 AI 味。必须包含 H2、FAQ、站内内链建议，不夸大承诺。';
  let articleBody = '';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    const aiRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `请写一篇 1500-2500 字中文 SEO 草稿，标题：${topic}\n栏目：${category}\n目标页面：${targetUrl}\n补充要求：${prompt || '面向中国家长，加入 FAQ 和自然内链。'}` },
        ],
        temperature: 0.45,
        max_tokens: 2800,
      }),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      articleBody = data.choices?.[0]?.message?.content?.trim() || '';
    }
  }
  if (!articleBody) articleBody = fallbackAiArticle({ topic, category, targetUrl });
  articleBody = articleBody.replace(/^---[\s\S]*?---\s*/, '').trim();
  const description = `${topic}完整指南：面向中国家长梳理适合人群、申请节奏、常见误区和下一步规划建议。`;
  const content = `---
title: ${quotedYaml(topic)}
slug: ${quotedYaml(slug)}
category: ${quotedYaml(category)}
categoryLabel: ${quotedYaml(category.toUpperCase())}
description: ${quotedYaml(description)}
keywords: ${quotedYaml(`${topic}, 新加坡择校, SEDA`)}
date: "${todayDate()}"
updated: "${todayDate()}"
draft: true
reviewStatus: "pending"
generatedBy: "cms-ai-queue"
targetUrl: ${quotedYaml(targetUrl)}
---

${articleBody}
`;
  const articleDir = join(process.cwd(), 'content', 'articles');
  mkdirSync(articleDir, { recursive: true });
  const file = join(articleDir, `${slug}.md`);
  writeFileSync(file, content, 'utf8');
  return { file: relativeArticlePath(file), slug, title: topic, category, targetUrl };
}

function handleCmsAiJobs(req, res) {
  if (!requireCmsAuth(req, res)) return;
  json(res, 200, { ok: true, jobs: readJsonl(CMS_AI_JOBS_FILE, 1000).reverse().slice(0, 200), teams: CMS_TEAMS.map(({ id, name }) => ({ id, name })) });
}

async function handleCmsAiJob(req, res) {
  if (!requireCmsAuth(req, res)) return;
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const session = cmsSession(req) || {};
  const allowedTeams = new Set(CMS_TEAMS.map((team) => team.id));
  const job = {
    id: cmsId('job'),
    topic: cleanLeadText(body.topic, 120),
    category: cleanAccountId(body.category || 'guides', 60) || 'guides',
    team: allowedTeams.has(body.team) ? body.team : (session.team === 'all' ? 'general' : session.team || 'general'),
    targetUrl: pageUrlPath(body.targetUrl || '/guides/'),
    prompt: cleanMultilineText(body.prompt, 1800),
    status: 'queued',
    createdBy: session.username || 'admin',
    createdAt: new Date().toISOString(),
  };
  try {
    const draft = await generateAiArticle(job);
    job.status = 'draft_ready';
    job.draftFile = draft.file;
    job.draftSlug = draft.slug;
    job.finishedAt = new Date().toISOString();
    mkdirSync(dirname(CMS_AI_JOBS_FILE), { recursive: true });
    appendFileSync(CMS_AI_JOBS_FILE, `${JSON.stringify(job)}\n`, 'utf8');
    const output = await rebuildContent();
    json(res, 200, { ok: true, job, draft, output });
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    mkdirSync(dirname(CMS_AI_JOBS_FILE), { recursive: true });
    appendFileSync(CMS_AI_JOBS_FILE, `${JSON.stringify(job)}\n`, 'utf8');
    json(res, 500, { error: 'AI 草稿生成失败', detail: error.message, job });
  }
}

async function handleCmsPageSave(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req) || {};
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const path = pageUrlPath(body.url);
  if (!path || path.includes('..')) return json(res, 400, { error: 'URL 无效' });
  const existing = savedPageRow(path);
  const allowedTeams = new Set(CMS_TEAMS.map((team) => team.id));
  const allowedStatus = new Set(['todo', 'in_progress', 'ready', 'published', 'paused']);
  const allowedReview = new Set(['pending', 'needs_revision', 'approved']);
  const allowedImage = new Set(['missing', 'planned', 'uploaded', 'not_needed']);
  const nextTeam = allowedTeams.has(body.team) ? body.team : inferPageTeam(path);
  if (session.team && session.team !== 'all' && nextTeam !== session.team) return json(res, 403, { error: '不能维护其他团队的页面' });
  const rows = readJsonl(CMS_PAGES_FILE, 100000).filter((row) => pageUrlPath(row.url) !== path);
  const record = {
    ...existing,
    url: path,
    title: cleanSlugText(body.title || pageTitleFromPath(path), 160),
    team: nextTeam,
    owner: cleanLeadText(body.owner, 80),
    status: allowedStatus.has(body.status) ? body.status : 'todo',
    priority: ['low', 'normal', 'high'].includes(body.priority) ? body.priority : 'normal',
    contentType: cleanLeadText(body.contentType || 'seo-page', 50),
    reviewStatus: allowedReview.has(body.reviewStatus) ? body.reviewStatus : 'pending',
    imageStatus: allowedImage.has(body.imageStatus) ? body.imageStatus : 'missing',
    imageUrl: cleanLeadText(body.imageUrl, 240),
    imageBrief: cleanMultilineText(body.imageBrief, 1200),
    aiPrompt: cleanMultilineText(body.aiPrompt, 1600),
    notes: cleanMultilineText(body.notes, 1600),
    updatedAt: new Date().toISOString(),
  };
  rows.push(record);
  rows.sort((a, b) => pageUrlPath(a.url).localeCompare(pageUrlPath(b.url)));
  writeJsonl(CMS_PAGES_FILE, rows);
  json(res, 200, { ok: true, page: record, summary: pageMatrixSummary() });
}

function canAccessPage(session, path) {
  if (!session) return false;
  if (session.role === 'admin' || session.team === 'all') return true;
  const page = pageRecords().find((item) => item.url === pageUrlPath(path));
  return (page?.team || inferPageTeam(path)) === session.team;
}

function handleCmsPageContent(req, res, url) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req);
  const path = pageUrlPath(url.searchParams.get('url') || '/');
  if (!canAccessPage(session, path)) return json(res, 403, { error: '不能查看其他团队的页面正文' });
  const file = pageFilePath(path);
  if (!file || !existsSync(file)) return json(res, 404, { error: '页面文件不存在' });
  const html = readFileSync(file, 'utf8');
  const row = savedPageRow(path);
  json(res, 200, {
    ok: true,
    url: path,
    title: row.title || pageTitleFromPath(path),
    liveBlocks: extractPageBlocks(html),
    draftBlocks: Array.isArray(row.bodyDraftBlocks) ? row.bodyDraftBlocks : [],
    bodyStatus: row.bodyStatus || '',
    bodyNote: row.bodyNote || '',
    bodyUpdatedAt: row.bodyUpdatedAt || '',
    bodyUpdatedBy: row.bodyUpdatedBy || '',
  });
}

async function handleCmsPageContentSave(req, res) {
  if (!requireCmsAuth(req, res)) return;
  const session = cmsSession(req);
  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: '请求格式错误' }); }
  const path = pageUrlPath(body.url);
  if (!canAccessPage(session, path)) return json(res, 403, { error: '不能保存其他团队的页面正文' });
  const blocks = Array.isArray(body.blocks) ? body.blocks.slice(0, 120).map((block, index) => ({
    id: cleanAccountId(block.id || `block_${index + 1}`, 60),
    tag: ['h1', 'h2', 'h3', 'h4', 'p', 'li'].includes(String(block.tag || '').toLowerCase()) ? String(block.tag).toLowerCase() : 'p',
    text: cleanMultilineText(block.text, 900),
  })).filter((block) => block.text) : [];
  if (!blocks.length) return json(res, 400, { error: '正文草稿不能为空' });
  const rows = readJsonl(CMS_PAGES_FILE, 100000).filter((row) => pageUrlPath(row.url) !== path);
  const existing = savedPageRow(path);
  const record = {
    ...existing,
    url: path,
    title: existing.title || pageTitleFromPath(path),
    team: existing.team || inferPageTeam(path),
    status: existing.status || 'in_progress',
    reviewStatus: body.status === 'approved' ? 'approved' : 'pending',
    imageStatus: existing.imageStatus || 'missing',
    bodyDraftBlocks: blocks,
    bodyStatus: body.status === 'approved' ? 'approved' : 'pending',
    bodyNote: cleanMultilineText(body.note, 1200),
    bodyUpdatedAt: new Date().toISOString(),
    bodyUpdatedBy: session?.username || 'admin',
    updatedAt: new Date().toISOString(),
  };
  rows.push(record);
  rows.sort((a, b) => pageUrlPath(a.url).localeCompare(pageUrlPath(b.url)));
  writeJsonl(CMS_PAGES_FILE, rows);
  json(res, 200, { ok: true, content: record });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // CORS preflight
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }); return res.end(); }

  if (req.method === 'POST' && url.pathname === '/api/cms/login') return handleCmsLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/logout') return handleCmsLogout(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/me') return json(res, 200, { authenticated: isAuthenticated(req), user: cmsSession(req) });
  if (req.method === 'GET' && url.pathname === '/api/cms/users') return handleCmsUsers(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/user') return handleCmsUserSave(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/geo-debug') return handleCmsGeoDebug(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/overview') return handleCmsOverview(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/status') return cmsStats(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/analytics') return handleCmsAnalytics(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/cms/seo') return handleCmsSeo(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/seo') return handleCmsSeoSave(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/leads') return handleCmsLeads(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/cms/leads/export') return handleCmsLeadsExport(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/lead') return handleCmsLeadUpdate(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/pages') return handleCmsPages(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/page') return handleCmsPageSave(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/page-content') return handleCmsPageContent(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/page-content') return handleCmsPageContentSave(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/media') return handleCmsMediaList(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/media') return handleCmsMediaUpload(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/ai-jobs') return handleCmsAiJobs(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/ai-job') return handleCmsAiJob(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/articles') return listCmsArticles(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/article') return getCmsArticle(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/article') return saveCmsArticle(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/article-image') return handleCmsArticleImage(req, res);
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
