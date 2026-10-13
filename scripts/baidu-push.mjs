// Baidu 主动推送 (普通收录) — pushes the curated quality URLs from baidu-sitemap.xml
// to Baidu's urls/submit API so they enter the crawl queue the same day.
//
// Design:
//  - Source of URLs = baidu-sitemap.xml (already excludes thin template pages via robots).
//  - Priority order = homepage, then shallow hub pages, then deeper pages (freshest first).
//  - State (data/seo/baidu-push-state.json) remembers what was pushed, so each run
//    pushes NEW pages + a small rotating refresh of older ones — never spam-re-pushing
//    everything daily, which would waste Baidu's quota.
//  - Token stays in the environment (GitHub Secret); it is never written to disk or logs.
//
// Env:
//   BAIDU_TOKEN  (required)  the 主动推送 token from 百度搜索资源平台 → 链接提交 → 主动推送
//   BAIDU_SITE   (default https://sgeda.org.cn)  the site exactly as verified in 站长平台
//   PUSH_MAX     (default 2000)  max URLs per run (Baidu accepts up to 2000 per call)
//   REFRESH_PER_RUN (default 30)  how many already-pushed URLs to re-submit each run (rotation)
//   DRY_RUN      (set to "1" to build the batch and print it WITHOUT calling Baidu)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let siteInput = (process.env.BAIDU_SITE || 'https://sgeda.org.cn').trim().replace(/\/$/, '');
if (!/^https?:\/\//i.test(siteInput)) siteInput = 'https://' + siteInput; // allow bare domain in env
const site = siteInput;
const host = new URL(site).host;
const token = process.env.BAIDU_TOKEN || '';
const pushMax = Math.max(1, Math.min(2000, Number(process.env.PUSH_MAX) || 2000));
const refreshPerRun = Math.max(0, Number(process.env.REFRESH_PER_RUN) || 30);
const dryRun = process.env.DRY_RUN === '1';

const sitemapFile = path.join(root, 'baidu-sitemap.xml');
const stateFile = process.env.BAIDU_PUSH_STATE || path.join(root, 'data/seo/baidu-push-state.json');

function fail(msg) { console.error(`❌ ${msg}`); process.exit(1); }

// --- read the curated URL list -------------------------------------------------
if (!fs.existsSync(sitemapFile)) fail(`baidu-sitemap.xml not found at ${sitemapFile}`);
const xml = fs.readFileSync(sitemapFile, 'utf8');
const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]
  .map(m => ({ url: m[1].trim(), lastmod: (m[2] || '').trim() }))
  .filter(e => { try { return new URL(e.url).host === host; } catch { return false; } });

if (!entries.length) fail('No eligible URLs found in baidu-sitemap.xml');

// --- priority ordering: homepage, then shallow hubs, then deeper & freshest ----
function depth(u) { return new URL(u).pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean).length; }
entries.sort((a, b) => {
  const da = depth(a.url), db = depth(b.url);
  if (da !== db) return da - db;                    // shallower (hubs) first
  return (b.lastmod || '').localeCompare(a.lastmod || ''); // then freshest first
});

// --- state: what we have already pushed ---------------------------------------
let state = { pushed: {}, refreshCursor: 0, runs: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; } catch { /* first run */ }
state.pushed = state.pushed || {};

const newUrls = entries.filter(e => !state.pushed[e.url]).map(e => e.url);

// rotating refresh of already-pushed URLs (so stale pages get re-crawled over time)
const allUrls = entries.map(e => e.url);
const refresh = [];
if (refreshPerRun > 0 && allUrls.length) {
  let cursor = Number(state.refreshCursor) || 0;
  for (let i = 0; i < Math.min(refreshPerRun, allUrls.length); i++) {
    refresh.push(allUrls[cursor % allUrls.length]);
    cursor++;
  }
  state.refreshCursor = cursor % allUrls.length;
}

let batch = [...new Set([...newUrls, ...refresh])].slice(0, pushMax);

console.log(`Site: ${site}`);
console.log(`Eligible quality URLs: ${entries.length}`);
console.log(`New (never pushed): ${newUrls.length} | Rotating refresh: ${refresh.length} | Pre-verify batch: ${batch.length}`);

if (!batch.length) { console.log('✅ Nothing new to push and refresh disabled — done.'); process.exit(0); }
if (dryRun) { console.log('\n[DRY_RUN] Would push (before live 200 check):\n' + batch.join('\n')); process.exit(0); }

// --- safety: only push URLs that are actually live (HTTP 200) ------------------
// Guards against undeployed drafts / stale sitemap entries that would 404 at Baidu.
if (process.env.VERIFY !== '0') {
  const ok = new Array(batch.length).fill(false);
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < batch.length) {
      const i = cursor++;
      try {
        let r = await fetch(batch[i], { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (r.status === 405) r = await fetch(batch[i], { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000) });
        ok[i] = r.status === 200;
      } catch { ok[i] = false; }
    }
  }));
  const dropped = batch.filter((_, i) => !ok[i]);
  batch = batch.filter((_, i) => ok[i]);
  if (dropped.length) console.log(`⚠️ Dropped ${dropped.length} non-200 URL(s) before push: ${dropped.slice(0, 5).join(', ')}${dropped.length > 5 ? '…' : ''}`);
  console.log(`Live (200) batch to push: ${batch.length}`);
  if (!batch.length) { console.log('Nothing live to push.'); process.exit(0); }
}
if (!token) fail('BAIDU_TOKEN is not set (expected as an environment variable / GitHub Secret).');

// --- push to Baidu ------------------------------------------------------------
// The `site` param must match the verified property EXACTLY. Baidu's bare-domain
// form is tried first (that is what worked for this site), with protocol variants
// as fallback. "site init fail" = wrong site param; "over quota" = correct site
// but today's quota is used up (Baidu gives low-index sites a small daily quota).
const bare = host;                      // sgeda.org.cn
const variants = [...new Set([
  bare,                                 // sgeda.org.cn   (correct for this property)
  site,                                 // https://sgeda.org.cn
  `http://${bare}`,
  `https://www.${bare.replace(/^www\./, '')}`,
])];
const chunkStart = Math.max(1, Math.min(2000, Number(process.env.PUSH_CHUNK) || 50));

async function pushWith(siteParam, urls) {
  const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteParam)}&token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: urls.join('\n'), signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: res.status, message: text.slice(0, 200) }; }
  } catch (e) { return { error: -1, message: e.message }; }
}
const isQuota = d => d && d.error && /quota/i.test(d.message || '');
const isWrongSite = d => d && d.error && /(init fail|not exist|site error|站点)/i.test(d.message || '');

// 1) detect the accepted site param with a 1-URL probe (minimal quota cost)
let workingSite = null, probe = null;
for (const v of variants) {
  probe = await pushWith(v, batch.slice(0, 1));
  if (isWrongSite(probe)) { console.log(`· site="${v}" → ${probe.message}`); continue; }
  workingSite = v; break;                 // success OR over-quota => this site is correct
}
if (!workingSite) fail('所有 site 格式都 site init fail。请到 百度搜索资源平台 → 链接提交 → 主动推送，\n' +
  '核对示例里的 site= 值与 token，并确认 sgeda.org.cn 站点状态为「正常」；token 若更新请改 GitHub Secret BAIDU_TOKEN。');
console.log(`Matched site param: ${workingSite}`);

// 2) quota-aware chunked push: shrink the chunk on "over quota" to use up exactly
//    whatever quota remains today; resume the rest on the next daily run via state.
let totalSuccess = 0, lastRemain, quotaHit = false;
const pushedUrls = [];
let remaining = [...batch];
if (!probe.error) { totalSuccess += Number(probe.success) || 0; lastRemain = probe.remain; pushedUrls.push(batch[0]); remaining = batch.slice(1); }
else if (isQuota(probe)) { quotaHit = true; }

let chunkSize = chunkStart;
while (!quotaHit && remaining.length) {
  const group = remaining.slice(0, chunkSize);
  const d = await pushWith(workingSite, group);
  if (isQuota(d)) { if (chunkSize <= 1) { quotaHit = true; break; } chunkSize = Math.max(1, Math.floor(chunkSize / 2)); continue; }
  if (d.error) fail(`Baidu API error ${d.error}: ${d.message}`);
  totalSuccess += Number(d.success) || 0; lastRemain = d.remain; pushedUrls.push(...group); remaining = remaining.slice(group.length);
  if (lastRemain === 0) { quotaHit = true; break; }
}

console.log(`\n✅ Pushed this run: ${pushedUrls.length} URL(s), Baidu success: ${totalSuccess}, remain quota: ${lastRemain ?? 'n/a'}`);
if (quotaHit) console.log(`ℹ️ 今日配额用尽，剩余 ${remaining.length} 个将在后续每日运行中继续推送。`);

// --- persist state (only URLs actually pushed) --------------------------------
const stampedAt = new Date().toISOString();
for (const u of pushedUrls) state.pushed[u] = stampedAt;
state.runs = [...(state.runs || []), { at: stampedAt, site: workingSite, pushed: pushedUrls.length, success: totalSuccess, remain: lastRemain ?? null, quotaHit }].slice(-30);
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
console.log(`State saved: ${Object.keys(state.pushed).length}/${entries.length} quality URLs pushed so far.`);
