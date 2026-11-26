import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog, loadCatalogPolicy, validateCatalog } from './school-catalog.mjs';
import { SITE, BAIDU_PRIORITY_LIMIT, inspectPage, localFile } from './seo-pages.mjs';

const PRIVATE_PREFIXES = ['/cms/', '/content-review/', '/api/', '/content/', '/data/', '/scripts/', '/tests/', '/docs/'];

export function renderCatalogRobots() {
  const restrictions = PRIVATE_PREFIXES.map(prefix => `Disallow: ${prefix}`).join('\n');
  return `# Public catalog pages and substantive content are crawlable.\n# Former school profile URLs must be crawlable to expose their HTTP 301.\n# Indexing is not guaranteed by Allow or a sitemap.\nUser-agent: *\nAllow: /\n${restrictions}\n\nUser-agent: Baiduspider\nAllow: /\n${restrictions}\n\nSitemap: ${SITE}/baidu-sitemap.xml\nSitemap: ${SITE}/sitemap.xml\n`;
}

export function applyCatalogCrawlPolicy(root = process.cwd()) {
  const records = loadCatalog(root);
  const policy = loadCatalogPolicy(root);
  validateCatalog(records, policy);
  // Relax the old template-prefix blocks only after exact migration is in
  // place. A record's thin legacy page must not be opened as a 200 article.
  for (const redirect of policy.redirects) {
    const file = localFile(root, SITE + redirect.from);
    if (!file || !fs.existsSync(file)) throw new Error(`Missing migration fallback: ${redirect.from}`);
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('<!-- SEDA_SCHOOL_REDIRECT -->') || !/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
      throw new Error(`Cannot relax template restrictions before migration: ${redirect.from}`);
    }
  }
  for (const route of ['/school-database/', ...policy.categories.map(category => category.route), ...policy.retainedDetails]) {
    const file = localFile(root, SITE + route);
    if (!file || !fs.existsSync(file)) throw new Error(`Missing public catalog/detail: ${route}`);
    const page = inspectPage(fs.readFileSync(file, 'utf8'), SITE + route);
    if (page.issues.length) throw new Error(`Invalid public catalog/detail ${route}: ${page.issues.join(', ')}`);
  }
  const robots = renderCatalogRobots();
  const file = path.join(root, 'robots.txt');
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (before !== robots) fs.writeFileSync(file, robots);
  return { changed: before !== robots, migrated: policy.redirects.length, retained: policy.retainedDetails.length };
}

export function updateCatalogPriority(root = process.cwd()) {
  const policy = loadCatalogPolicy(root);
  const file = path.join(root, 'data', 'seo', 'baidu-priority-urls.txt');
  const before = fs.readFileSync(file, 'utf8');
  const replacements = new Map(policy.redirects.map(redirect => [SITE + redirect.from, new URL(redirect.to, SITE).href.split('#')[0]]));
  const selected = [];
  const seen = new Set();
  for (const raw of before.split(/\r?\n/)) {
    const value = raw.trim();
    if (!value || value.startsWith('#')) continue;
    const url = replacements.get(value) || value;
    const parsed = new URL(url);
    if (parsed.origin !== SITE || parsed.hash || parsed.search) throw new Error(`Invalid selected URL: ${value}`);
    const pageFile = localFile(root, url);
    if (!pageFile || !fs.existsSync(pageFile)) throw new Error(`Missing selected page: ${url}`);
    const html = fs.readFileSync(pageFile, 'utf8');
    if (html.includes('<!-- SEDA_SCHOOL_REDIRECT -->') || inspectPage(html, url).issues.includes('noindex')) {
      throw new Error(`Selected URL is not an active page: ${url}`);
    }
    if (!seen.has(url)) { selected.push(url); seen.add(url); }
  }
  for (const route of ['/school-database/', ...policy.categories.map(category => category.route)]) {
    const url = SITE + route;
    if (!seen.has(url)) { selected.push(url); seen.add(url); }
  }
  if (selected.length > BAIDU_PRIORITY_LIMIT) throw new Error(`Catalog priority exceeds editorial cap: ${selected.length}`);
  // Preserve the established order; only append newly approved catalog hubs.
  const out = '# Reviewed canonical pages; this list is not a Baidu submission quota.\n' + selected.join('\n') + '\n';
  if (out !== before) fs.writeFileSync(file, out);
  return { changed: out !== before, total: selected.length };
}
