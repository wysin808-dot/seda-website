import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertLocalReferences, baiduAllowed, inspectPage, localFile, parseSitemap } from './seo-pages.mjs';
import { missingPublishedQueueRoutes } from './queue-publications.mjs';

const root = process.cwd();
const allowed = baiduAllowed(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'));
const entries = parseSitemap(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')).filter(e => allowed(e.url));
const errors = [];
for (const entry of entries) {
  const file = localFile(root, entry.url);
  if (!fs.existsSync(file)) { errors.push(`missing page ${entry.url}`); continue; }
  const page = inspectPage(fs.readFileSync(file, 'utf8'), entry.url);
  errors.push(...page.issues.map(issue => `${entry.url}: ${issue}`));
  errors.push(...assertLocalReferences(root, page));
}
const baidu = parseSitemap(fs.readFileSync(path.join(root, 'baidu-sitemap.xml'), 'utf8'));
const expected = new Set(entries.map(e => e.url));
for (const item of baidu) if (!expected.has(item.url)) errors.push(`ineligible Baidu sitemap URL: ${item.url}`);
for (const url of expected) if (!baidu.some(e => e.url === url)) errors.push(`missing Baidu sitemap URL: ${url}`);
const queue = fs.readFileSync(path.join(root, 'content', 'keyword-queue.csv'), 'utf8');
for (const item of missingPublishedQueueRoutes(queue, new Set(parseSitemap(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')).map(entry => entry.url)), SITE)) {
  errors.push(`queue reports unpublished URL as published: ${item.route} (line ${item.line})`);
}
console.log(JSON.stringify({ checked: entries.length, errors: [...new Set(errors)] }, null, 2));
if (errors.length) process.exitCode = 1;
