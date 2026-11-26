import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderCatalogRobots, applyCatalogCrawlPolicy } from '../scripts/catalog-crawl-policy.mjs';
import { baiduAllowed, SITE } from '../scripts/seo-pages.mjs';
import { loadCatalogPolicy } from '../scripts/school-catalog.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('public catalog, substantive content and legacy redirects remain crawlable', () => {
  const allowed = baiduAllowed(renderCatalogRobots());
  for (const route of ['/', '/school-database/', '/primary-schools/', '/primary-schools/ai-tong/',
    '/secondary-schools/pei-hwa/', '/international-school/schools/', '/private-schools/psb/',
    '/school-database/jc/', '/school-database/poly/', '/school-database/university/',
    '/assets/school-database.js', '/jc/raffles-institution/', '/guides/student-pass/']) {
    assert.equal(allowed(SITE + route), true, route);
  }
  for (const route of ['/cms/', '/content-review/', '/api/ai-assistant', '/content/schools/database.json',
    '/scripts/migrate-school-pages.mjs', '/tests/fixtures/example.html', '/data/seo/page-updates.json', '/docs/example.html']) {
    assert.equal(allowed(SITE + route), false, route);
  }
});

test('crawl restriction changes are refused before every legacy page has migrated', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-crawl-guard-'));
  const before = 'User-agent: Baiduspider\nDisallow: /primary-schools/\n';
  try {
    fs.mkdirSync(path.join(tmp, 'content/schools'), { recursive: true });
    for (const name of ['database.json', 'database-policy.json']) fs.copyFileSync(path.join(root, 'content/schools', name), path.join(tmp, 'content/schools', name));
    fs.writeFileSync(path.join(tmp, 'robots.txt'), before);
    assert.throws(() => applyCatalogCrawlPolicy(tmp), /Missing migration fallback/);
    assert.equal(fs.readFileSync(path.join(tmp, 'robots.txt'), 'utf8'), before);
    const first = loadCatalogPolicy(root).redirects[0].from;
    fs.mkdirSync(path.join(tmp, first), { recursive: true });
    fs.writeFileSync(path.join(tmp, first, 'index.html'), '<!-- SEDA_SCHOOL_REDIRECT --><main>Old article without noindex</main>');
    assert.throws(() => applyCatalogCrawlPolicy(tmp), /Cannot relax template restrictions/);
    assert.equal(fs.readFileSync(path.join(tmp, 'robots.txt'), 'utf8'), before);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
