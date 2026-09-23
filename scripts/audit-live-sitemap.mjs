import fs from 'node:fs';
import { parseSitemap } from './seo-pages.mjs';

const sitemapUrl = process.argv[2] || 'https://sgeda.org.cn/sitemap.xml';
const output = process.argv[3] || 'data/seo/live-sitemap-audit.json';
const xmlResponse = await fetch(sitemapUrl, { signal: AbortSignal.timeout(30_000) });
if (!xmlResponse.ok) throw new Error(`Unable to retrieve sitemap: HTTP ${xmlResponse.status}`);
const entries = parseSitemap(await xmlResponse.text());
const results = new Array(entries.length);
let next = 0;

async function inspect(entry) {
  const started = Date.now();
  try {
    let response = await fetch(entry.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    if (response.status === 405 || !String(response.headers.get('content-type') || '').includes('text/html')) {
      response = await fetch(entry.url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    }
    return {
      url: entry.url,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      location: response.headers.get('location') || '',
      xRobotsTag: response.headers.get('x-robots-tag') || '',
      ms: Date.now() - started,
    };
  } catch (error) {
    return { url: entry.url, status: 0, error: String(error.message || error), ms: Date.now() - started };
  }
}

await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < entries.length) {
    const index = next++;
    results[index] = await inspect(entries[index]);
  }
}));

const failures = results.filter((result) => result.status !== 200 || !result.contentType.includes('text/html'));
const summary = {
  checkedAt: new Date().toISOString(),
  sitemapUrl,
  total: results.length,
  healthy: results.length - failures.length,
  failures,
};
fs.mkdirSync(new URL('.', `file://${process.cwd()}/${output}`).pathname, { recursive: true });
fs.writeFileSync(output, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ total: summary.total, healthy: summary.healthy, failures: failures.length, output }, null, 2));
if (failures.length) process.exitCode = 1;
