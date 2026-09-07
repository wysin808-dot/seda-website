#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { SITE, baiduAllowed, inspectPage, parseSitemap } from './seo-pages.mjs';
import { selectBatch, recordAccepted } from './baidu-queue.mjs';

const site = (process.env.SITE || SITE).replace(/\/$/, '');
const root = process.env.SITE_DIR || process.cwd();
const reportFile = process.env.SEO_DAILY_REPORT || path.join(root, 'reports/seo-daily-report.md');
const stateFile = process.env.BAIDU_STATE_FILE || path.join(root, 'data/seo/baidu-state.json');
const limit = Math.max(1, Math.min(5, Number(process.env.BAIDU_SUBMIT_LIMIT) || 5));
const enabled = ['true', '1'].includes(process.env.SUBMIT_TO_BAIDU || 'false');
const token = process.env.BAIDU_TOKEN;
const now = new Date();

async function request(url, method = 'GET') {
  const start = Date.now();
  try {
    const response = await fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const text = method === 'GET' ? await response.text() : '';
    return { url, status: response.status, ms: Date.now() - start, text, type: response.headers.get('content-type') || '',
      robots: response.headers.get('x-robots-tag') || '', location: response.headers.get('location') };
  } catch { return { url, status: 0, ms: Date.now() - start, text: '', type: '', error: 'Request failed or timed out' }; }
}

async function concurrent(items, fn) {
  let cursor = 0;
  const out = [];
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cursor < items.length) { const index = cursor++; out[index] = await fn(items[index]); }
  }));
  return out;
}

async function checkReference(url) {
  let current = url;
  for (let n = 0; n < 4; n++) {
    let result = await request(current, 'HEAD');
    if (result.status === 405) result = await request(current);
    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = new URL(result.location, current);
      if (next.origin !== site) return { ...result, url, status: 0, error: 'Redirect leaves the site' };
      current = next.href;
      continue;
    }
    const { text, ...summary } = result;
    return { ...summary, url };
  }
  return { url, status: 0, error: 'Redirect loop' };
}

function table(rows, keys) {
  if (!rows.length) return '_无_';
  const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  return [`| ${keys.join(' | ')} |`, `| ${keys.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${keys.map(k => cell(row[k])).join(' | ')} |`)].join('\n');
}

const errors = [];
let pages = [], sitemapEntries = [], baiduEntries = [], references = [], batch = [], blocked = 0;
let push = { skipped: true, reason: enabled ? 'No eligible URLs' : 'Read-only check; Baidu submission disabled' };
try {
  const [sitemap, robots, baiduSitemap] = await Promise.all(['sitemap.xml', 'robots.txt', 'baidu-sitemap.xml'].map(file => request(`${site}/${file}`)));
  for (const entry of [sitemap, robots, baiduSitemap]) if (entry.status !== 200) throw new Error(`Required resource HTTP ${entry.status}: ${entry.url}`);
  sitemapEntries = parseSitemap(sitemap.text);
  baiduEntries = parseSitemap(baiduSitemap.text);
  const allowed = baiduAllowed(robots.text, site);
  const eligible = sitemapEntries.filter(entry => allowed(entry.url));
  blocked = sitemapEntries.length - eligible.length;
  const expected = new Set(eligible.map(e => e.url));
  const baiduSet = new Set(baiduEntries.map(e => e.url));
  for (const url of expected) if (!baiduSet.has(url)) errors.push(`Missing from Baidu sitemap: ${url}`);
  for (const url of baiduSet) if (!expected.has(url)) errors.push(`Ineligible Baidu sitemap URL: ${url}`);
  pages = await concurrent(eligible, async entry => {
    const response = await request(entry.url);
    if (response.status !== 200 || !response.type.includes('text/html')) return { ...entry, status: response.status, issues: [`HTTP ${response.status} or non-HTML page`], images: [], links: [] };
    const page = inspectPage(response.text, entry.url);
    if (/noindex|\bnone\b/i.test(response.robots)) page.issues.push('HTTP noindex');
    return { ...entry, ...page, status: response.status, ms: response.ms };
  });
  for (const key of ['title', 'description']) {
    const groups = new Map();
    for (const page of pages) if (page[key]) groups.set(page[key], [...(groups.get(page[key]) || []), page]);
    for (const group of groups.values()) if (group.length > 1) for (const page of group) page.issues.push(`duplicate ${key} (${group.length} pages)`);
  }
  const pageMap = new Map(pages.map(p => [p.url, p]));
  const images = new Set(pages.flatMap(p => p.images));
  const urls = [...new Set(pages.flatMap(p => [...p.links, ...p.images]))].filter(url => !new URL(url).pathname.startsWith('/api/'));
  references = await concurrent(urls, async url => {
    if (pageMap.has(url) && !images.has(url)) return { url, status: pageMap.get(url).status, type: 'text/html' };
    return checkReference(url);
  });
  const invalid = new Set(references.filter(r => r.status !== 200 || (images.has(r.url) && !r.type?.startsWith('image/'))).map(r => r.url));
  for (const page of pages) {
    for (const url of page.images) if (invalid.has(url)) page.issues.push(`broken image: ${url}`);
    for (const url of page.links) if (invalid.has(url)) page.issues.push(`broken link: ${url}`);
  }
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const priorityFile = path.join(root, 'data/seo/priority-urls.txt');
  const priorities = fs.existsSync(priorityFile) ? fs.readFileSync(priorityFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith(site + '/')) : [];
  batch = selectBatch(pages.filter(p => baiduSet.has(p.url)), state, limit, priorities, now);
  if (enabled && !token) { push = { skipped: true, reason: 'BAIDU_TOKEN is missing' }; errors.push(push.reason); }
  else if (enabled && batch.length) {
    try {
      const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(site)}&token=${encodeURIComponent(token)}`;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: batch.map(p => p.url).join('\n'), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      push = { skipped: false, status: response.status, ok: response.ok && !body.error, submitted: batch.length, response: body, urls: batch.map(p => p.url) };
      if (recordAccepted(state, batch, push, now)) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2));
        fs.renameSync(stateFile + '.tmp', stateFile);
      } else errors.push('Baidu did not confirm full acceptance; queue retained for retry');
    } catch { push = { skipped: false, ok: false, error: 'Baidu response unavailable or invalid; queue unchanged' }; errors.push(push.error); }
  }
} catch (error) { errors.push(error.message); }

const issues = [...errors, ...pages.flatMap(page => page.issues.map(issue => `${page.url}: ${issue}`))];
const result = { generated: now.toISOString(), site, sitemapUrls: sitemapEntries.length, baiduSitemapUrls: baiduEntries.length,
  checked: pages.length, robotsExcluded: blocked, issues, push, nextBatch: batch.map(p => p.url), pages, references };
const report = `# SEDA SEO Daily Bot

Generated: ${result.generated}
Site: ${site}

## Summary

- Source: live production HTML, robots and sitemaps
- Sitemap URLs: ${sitemapEntries.length}
- Baidu sitemap URLs: ${baiduEntries.length}
- Live HTML pages checked: ${pages.length}
- Excluded by robots: ${blocked}
- Unique internal references checked: ${references.length}
- Critical issues: ${issues.length}
- Indexing and search traffic: not measured by this bot; check Baidu Search Resource Platform

## Baidu Push

${push.skipped ? `Skipped: ${push.reason}` : `Submitted: ${push.submitted || 0}\n\nStatus: ${push.status || 'unavailable'}\n\nResponse:\n\n\`\`\`json\n${JSON.stringify(push.response || { error: push.error }, null, 2)}\n\`\`\``}

${table(batch.map(p => ({ URL: p.url, Updated: p.modified || p.lastmod || '-' })), ['URL', 'Updated'])}

Accepted URLs are discovery submissions, not proof of Baidu indexing or ranking. A response with remain=0 and success=5 is success with no remaining quota; over quota is an API error.

## Priority Fix List

${table(issues.slice(0, 100).map(Issue => ({ Issue })), ['Issue'])}

## Live Check

${table(pages.map(p => ({ URL: p.url, Status: p.status, Issues: p.issues.join('; ') || '-' })), ['URL', 'Status', 'Issues'])}
`;
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, report);
fs.writeFileSync(reportFile.replace(/\.md$/, '.json'), JSON.stringify(result, null, 2));
console.log(`Checked ${pages.length} live pages; ${issues.length} issues. Report: ${reportFile}`);
if (issues.length && process.env.FAIL_ON_CRITICAL !== 'false') process.exitCode = 1;
