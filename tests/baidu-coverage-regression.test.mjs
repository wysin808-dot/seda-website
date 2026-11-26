import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BAIDU_PRIORITY_LIMIT, SITE, baiduAllowed, inspectPage, localFile, parseSitemap, prioritySitemapEntries } from '../scripts/seo-pages.mjs';
import { loadCatalogPolicy } from '../scripts/school-catalog.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const robots = read('robots.txt');
const allowed = baiduAllowed(robots);
const entries = parseSitemap(read('sitemap.xml'));
const priority = prioritySitemapEntries(entries, read('data/seo/baidu-priority-urls.txt'), { allowed });
const catalogPolicy = loadCatalogPolicy(root);

const requiredRoutes = [
  '/', '/wace/', '/aeis/', '/ossd/', '/contact/', '/news/', '/poly/dae/', '/primary-schools/kong-hwa/',
  '/school-database/', ...catalogPolicy.categories.map(category => category.route),
  '/aeis/aeis-primary-english-grammar-chinese-students/',
  ...['hwa-chong-institution', 'raffles-institution', 'national-jc', 'victoria-jc', 'eunoia-jc',
    'anglo-chinese-jc', 'nanyang-jc', 'temasek-jc', 'catholic-jc', 'anderson-serangoon-jc',
    'jurong-pioneer-jc', 'tampines-meridian-jc', 'yishun-innova-jc', 'dunman-high',
    'river-valley-high', 'st-andrews-jc'].map(slug => `/jc/${slug}/`),
];

test('approved public pages and all school catalog hubs are in the curated map', () => {
  const urls = new Set(priority.map(entry => entry.url));
  for (const route of requiredRoutes) assert.ok(urls.has(SITE + route), `missing approved route ${route}`);
  assert.ok(priority.length >= 122 && priority.length <= BAIDU_PRIORITY_LIMIT);
  assert.equal(BAIDU_PRIORITY_LIMIT, 150);
  for (const route of ['/cms/', '/content-review/', '/api/site-config', '/content/articles/draft.md', '/tests/fixtures/']) {
    assert.equal(allowed(SITE + route), false, `unexpectedly unblocked ${route}`);
  }
});

test('migrated schools are crawlable for their 301 and absent from the active sitemap', () => {
  const urls = new Set(entries.map(entry => entry.url));
  for (const redirect of catalogPolicy.redirects) {
    assert.equal(allowed(SITE + redirect.from), true, `Baidu must read the 301: ${redirect.from}`);
    assert.equal(urls.has(SITE + redirect.from), false, `redirect in sitemap: ${redirect.from}`);
    const html = fs.readFileSync(localFile(root, SITE + redirect.from), 'utf8');
    assert.match(html, /SEDA_SCHOOL_REDIRECT/);
    assert.ok(inspectPage(html, SITE + redirect.from).issues.includes('noindex'));
  }
  for (const entry of entries) assert.equal(allowed(entry.url), true, `public page blocked: ${entry.url}`);
});

test('every curated map page exists with its intended canonical and indexable HTML', () => {
  for (const entry of priority) {
    const file = localFile(root, entry.url);
    assert.ok(fs.existsSync(file), `missing ${entry.url}`);
    const page = inspectPage(fs.readFileSync(file, 'utf8'), entry.url);
    assert.deepEqual(page.issues, [], `${entry.url}: ${page.issues.join(', ')}`);
    assert.match(entry.lastmod, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.lastmod <= new Date().toISOString().slice(0, 10), `future lastmod ${entry.url}`);
  }
});

test('published Baidu XML matches the approved source list exactly', () => {
  const current = parseSitemap(read('baidu-sitemap.xml'));
  assert.deepEqual(current, priority);
  assert.equal(new Set(current.map(entry => entry.url)).size, current.length);
});

test('Baiduspider group has no duplicate Allow directives', () => {
  const group = robots.split(/User-agent:\s*Baiduspider\s*/i)[1];
  assert.ok(group);
  const paths = [...group.matchAll(/^Allow:\s*(\S+)\s*$/gm)].map(match => match[1]);
  assert.equal(new Set(paths).size, paths.length);
});
