#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.SITE_DIR || process.cwd();
const site = (process.env.BAIDU_SITE || process.env.SITE || 'https://sgeda.org.cn').replace(/\/$/, '');
const sitemapFile = process.env.SITEMAP_FILE || path.join(root, 'sitemap.xml');
const priorityFile = process.env.PRIORITY_URLS_FILE || path.join(root, 'data', 'seo', 'priority-urls.txt');
const outputFile = process.env.SEO_DAILY_REPORT || path.join(root, 'reports', 'seo-daily-report.md');
const submitLimit = clamp(Number(process.env.BAIDU_SUBMIT_LIMIT || 20), 1, 200);
const checkLimit = clamp(Number(process.env.LIVE_CHECK_LIMIT || 30), 0, 100);
const baiduToken = process.env.BAIDU_TOKEN || '';
const submitToBaidu = parseBool(process.env.SUBMIT_TO_BAIDU, Boolean(baiduToken));
const failOnCritical = parseBool(process.env.FAIL_ON_CRITICAL, false);
const now = new Date();

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function stripHtml(value = '') {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? match[1].trim() : '';
}

function parseSitemap() {
  const raw = readText(sitemapFile);
  if (!raw) return [];
  return [...raw.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1];
    return {
      url: (block.match(/<loc>(.*?)<\/loc>/) || [])[1] || '',
      lastmod: (block.match(/<lastmod>(.*?)<\/lastmod>/) || [])[1] || '',
    };
  }).filter((item) => item.url.startsWith(site));
}

function routeFromUrl(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (!pathname.endsWith('/') && !pathname.endsWith('.html')) pathname += '/';
  return pathname;
}

function htmlPathForRoute(route) {
  if (route === '/') return path.join(root, 'index.html');
  if (route.endsWith('.html')) return path.join(root, route.replace(/^\//, ''));
  return path.join(root, route.replace(/^\//, ''), 'index.html');
}

function walkHtmlFiles(dir = root, files = []) {
  const skip = new Set(['.git', '.github', 'assets', 'content', 'data', 'docs', 'node_modules', 'reports', 'scripts', 'wace']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walkHtmlFiles(full, files);
      continue;
    }
    if (entry.isFile() && entry.name === 'index.html') files.push(full);
  }
  return files;
}

function analyzeHtml(file, url) {
  const html = readText(file);
  const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const descTag = (html.match(/<meta[^>]+name=["']description["'][^>]*>/i) || [])[0] || '';
  const description = getAttr(descTag, 'content');
  const h1 = stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const canonicalTag = (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [])[0] || '';
  const canonical = getAttr(canonicalTag, 'href');
  const robotsTag = (html.match(/<meta[^>]+name=["']robots["'][^>]*>/i) || [])[0] || '';
  const robots = getAttr(robotsTag, 'content').toLowerCase();
  const body = stripHtml((html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || html);
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const paragraphCount = (html.match(/<p\b/gi) || []).length;
  const internalLinks = (html.match(/href=["']\/(?!\/|#)/gi) || []).length;
  const issues = [];

  if (!title) issues.push('missing title');
  if (title && (title.length < 12 || title.length > 70)) issues.push(`title length ${title.length}`);
  if (!description) issues.push('missing description');
  if (description && (description.length < 50 || description.length > 180)) issues.push(`description length ${description.length}`);
  if (!h1) issues.push('missing h1');
  if (!canonical) issues.push('missing canonical');
  if (canonical && canonical !== url) issues.push('canonical mismatch');
  if (robots.includes('noindex')) issues.push('noindex');
  if (body.length < 900) issues.push(`thin text ${body.length}`);
  if (imageCount === 0) issues.push('no images');
  if (internalLinks < 3) issues.push(`low internal links ${internalLinks}`);

  return {
    url,
    file,
    title,
    description,
    h1,
    canonical,
    bodyLength: body.length,
    imageCount,
    paragraphCount,
    internalLinks,
    issues,
  };
}

function findDuplicates(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    grouped.set(value, [...(grouped.get(value) || []), item.url]);
  }
  return [...grouped.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([value, urls]) => ({ value, urls }))
    .sort((a, b) => b.urls.length - a.urls.length);
}

function readPriorityUrls(sitemapUrls) {
  const fromFile = readText(priorityFile)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http'));
  const defaults = [
    `${site}/`,
    `${site}/aeis/`,
    `${site}/o-level/`,
    `${site}/wace/`,
    `${site}/international-school/`,
    `${site}/primary-schools/`,
    `${site}/secondary-schools/`,
    `${site}/university/`,
    `${site}/guides/student-pass/`,
    `${site}/guides/cost/`,
  ];
  return [...new Set([...fromFile, ...defaults, ...sitemapUrls.slice(0, 20)])].filter((url) => url.startsWith(site));
}

async function checkLive(urls) {
  if (!checkLimit) return [];
  const selected = urls.slice(0, checkLimit);
  const results = [];
  for (const url of selected) {
    try {
      const started = Date.now();
      const res = await fetch(url, { method: 'GET', redirect: 'manual' });
      await res.arrayBuffer();
      results.push({ url, status: res.status, ms: Date.now() - started, ok: res.status >= 200 && res.status < 400 });
    } catch (error) {
      results.push({ url, status: 0, ms: 0, ok: false, error: error.message });
    }
  }
  return results;
}

async function submitBaidu(urls) {
  if (!submitToBaidu) return { skipped: true, reason: 'SUBMIT_TO_BAIDU is disabled or BAIDU_TOKEN is empty' };
  if (!baiduToken) return { skipped: true, reason: 'BAIDU_TOKEN is empty' };
  const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(new URL(site).host)}&token=${encodeURIComponent(baiduToken)}`;
  const batch = urls.slice(0, submitLimit);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: batch.join('\n'),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { skipped: false, status: res.status, ok: res.ok && !json.error, submitted: batch.length, response: json };
}

function markdownTable(rows, columns) {
  if (!rows.length) return '_无_';
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row)).replace(/\n/g, ' ').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function buildReport({ sitemapItems, htmlItems, missingFiles, orphanFiles, duplicateTitles, duplicateDescriptions, liveResults, baiduResult }) {
  const critical = [
    ...missingFiles.map((url) => `sitemap URL missing local file: ${url}`),
    ...htmlItems.filter((item) => item.issues.includes('noindex')).map((item) => `noindex: ${item.url}`),
    ...liveResults.filter((item) => !item.ok).map((item) => `live check failed ${item.status}: ${item.url}`),
  ];
  const warnings = [
    ...htmlItems.filter((item) => item.issues.length).map((item) => `${item.url}: ${item.issues.join(', ')}`),
    ...duplicateTitles.slice(0, 20).map((item) => `duplicate title (${item.urls.length}): ${item.value}`),
    ...duplicateDescriptions.slice(0, 20).map((item) => `duplicate description (${item.urls.length}): ${item.value}`),
  ];
  const weakPages = htmlItems
    .filter((item) => item.issues.length)
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 30);
  const slowPages = liveResults
    .filter((item) => item.ok)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10);

  return `# SEDA SEO Daily Bot

Generated: ${now.toISOString()}
Site: ${site}

## Summary

- Sitemap URLs: ${sitemapItems.length}
- Local HTML pages checked: ${htmlItems.length}
- Missing local files from sitemap: ${missingFiles.length}
- Local pages not in sitemap: ${orphanFiles.length}
- Duplicate titles: ${duplicateTitles.length}
- Duplicate descriptions: ${duplicateDescriptions.length}
- Live URLs checked: ${liveResults.length}
- Critical issues: ${critical.length}
- Warnings: ${warnings.length}

## Baidu Push

${baiduResult.skipped ? `Skipped: ${baiduResult.reason}` : `Submitted: ${baiduResult.submitted}\n\nStatus: ${baiduResult.status}\n\nResponse:\n\n\`\`\`json\n${JSON.stringify(baiduResult.response, null, 2)}\n\`\`\``}

## Priority Fix List

${markdownTable(weakPages, [
  { label: 'URL', value: (row) => row.url },
  { label: 'Issues', value: (row) => row.issues.join(', ') },
  { label: 'Text', value: (row) => row.bodyLength },
  { label: 'Images', value: (row) => row.imageCount },
  { label: 'Links', value: (row) => row.internalLinks },
])}

## Duplicate Titles

${markdownTable(duplicateTitles.slice(0, 20), [
  { label: 'Count', value: (row) => row.urls.length },
  { label: 'Title', value: (row) => row.value },
  { label: 'Example', value: (row) => row.urls.slice(0, 3).join(', ') },
])}

## Duplicate Descriptions

${markdownTable(duplicateDescriptions.slice(0, 20), [
  { label: 'Count', value: (row) => row.urls.length },
  { label: 'Description', value: (row) => row.value },
  { label: 'Example', value: (row) => row.urls.slice(0, 3).join(', ') },
])}

## Live Check

${markdownTable(liveResults, [
  { label: 'URL', value: (row) => row.url },
  { label: 'Status', value: (row) => row.status },
  { label: 'Time', value: (row) => (row.ms ? `${row.ms}ms` : '-') },
  { label: 'OK', value: (row) => row.ok ? 'yes' : 'no' },
])}

## Slowest Live Pages

${markdownTable(slowPages, [
  { label: 'URL', value: (row) => row.url },
  { label: 'Status', value: (row) => row.status },
  { label: 'Time', value: (row) => `${row.ms}ms` },
])}

## Critical Issues

${critical.length ? critical.map((item) => `- ${item}`).join('\n') : '_无_'}

## All Warnings

${warnings.length ? warnings.slice(0, 200).map((item) => `- ${item}`).join('\n') : '_无_'}
`;
}

const sitemapItems = parseSitemap();
const sitemapUrls = sitemapItems.map((item) => item.url);
const sitemapSet = new Set(sitemapUrls);
const htmlItems = [];
const missingFiles = [];

for (const item of sitemapItems) {
  const file = htmlPathForRoute(routeFromUrl(item.url));
  if (!fs.existsSync(file)) {
    missingFiles.push(item.url);
    continue;
  }
  htmlItems.push(analyzeHtml(file, item.url));
}

const localHtmlFiles = walkHtmlFiles();
const orphanFiles = localHtmlFiles.filter((file) => {
  const relative = path.relative(root, file);
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/\/index\.html$/, '/')}`;
  return !sitemapSet.has(`${site}${route}`);
});

const duplicateTitles = findDuplicates(htmlItems, 'title');
const duplicateDescriptions = findDuplicates(htmlItems, 'description');
const priorityUrls = readPriorityUrls(sitemapUrls);
const liveResults = await checkLive(priorityUrls);
const baiduResult = await submitBaidu(priorityUrls);
const report = buildReport({ sitemapItems, htmlItems, missingFiles, orphanFiles, duplicateTitles, duplicateDescriptions, liveResults, baiduResult });

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, report, 'utf8');
console.log(report);

const criticalCount = (report.match(/^- sitemap URL missing local file:|^- noindex:|^- live check failed/gm) || []).length;
if (failOnCritical && criticalCount > 0) process.exit(1);
