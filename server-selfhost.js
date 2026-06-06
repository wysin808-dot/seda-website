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
const CMS_VERSION = 'lite-1';
const CMS_CAPABILITIES = {
  auth: 'password-cookie',
  contentStore: 'markdown-frontmatter',
  analytics: 'jsonl-pageviews',
  geoIp: 'optional-local-ip2region',
  workflow: ['draft', 'needs_revision', 'approved', 'archived'],
  futureReady: ['roles', 'media', 'scheduledPublish', 'revisionHistory', 'crmSync'],
};
const ANALYTICS_DIR = join(process.cwd(), 'data', 'analytics');
const ANALYTICS_FILE = join(ANALYTICS_DIR, 'events.jsonl');
const LEADS_DIR = join(process.cwd(), 'data', 'leads');
const LEADS_FILE = join(LEADS_DIR, 'leads.jsonl');
const SEO_DIR = join(process.cwd(), 'data', 'seo');
const SEO_DAILY_FILE = join(SEO_DIR, 'daily.jsonl');
const SEO_SUBMISSION_FILE = join(SEO_DIR, 'submissions.jsonl');

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
  const recent = pageviews.slice(-20).reverse().map((event) => ({
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
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || process.env.GA_MEASUREMENT_ID || '',
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // CORS preflight
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }); return res.end(); }

  if (req.method === 'POST' && url.pathname === '/api/cms/login') return handleCmsLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/cms/logout') return handleCmsLogout(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/me') return json(res, 200, { authenticated: isAuthenticated(req) });
  if (req.method === 'GET' && url.pathname === '/api/cms/geo-debug') return handleCmsGeoDebug(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/overview') return handleCmsOverview(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/status') return cmsStats(req, res);
  if (req.method === 'GET' && url.pathname === '/api/cms/analytics') return handleCmsAnalytics(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/cms/seo') return handleCmsSeo(req, res, url);
  if (req.method === 'POST' && url.pathname === '/api/cms/seo') return handleCmsSeoSave(req, res);
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
