import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogCoverageMatrix } from '../scripts/catalog-coverage.mjs';
import { CATEGORIES, loadCatalog } from '../scripts/school-catalog.mjs';
import { renderSchoolDatabase } from '../scripts/build-school-database.mjs';
import { parseSitemap, SITE } from '../scripts/seo-pages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const records = loadCatalog(root);
const routes = CATEGORIES.map(category => SITE + category.route);
function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-catalog-coverage-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tmp, 'content/schools'), { recursive: true });
  for (const name of ['database.json', 'database-policy.json']) fs.copyFileSync(path.join(root, 'content/schools', name), path.join(tmp, 'content/schools', name));
  for (const category of CATEGORIES) {
    const file = path.join(tmp, category.route, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderSchoolDatabase(records, { category: category.id }));
  }
  return tmp;
}

test('CMS counts all 415 catalog records, not missing retired pages or 415 independent sitemap URLs', () => {
  const matrix = catalogCoverageMatrix(root, parseSitemap(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')).map(entry => entry.url));
  assert.equal(matrix.mode, 'catalog');
  assert.equal(matrix.groups.length, 7);
  assert.deepEqual(matrix.totals, { sourceCount: 415, targetCount: 415, generatedCount: 415, sitemapCount: 415, missingPageCount: 0, missingSitemapCount: 0, dataGap: 0 });
  for (const group of matrix.groups) assert.deepEqual(group.nextActions, []);
  const html = fs.readFileSync(path.join(root, 'cms/index.html'), 'utf8');
  assert.match(html, /地图覆盖记录/);
});

test('a missing school hash is reported as a missing record, never an instruction to restore a thin article', t => {
  const tmp = fixture(t);
  const first = records.find(record => record.category === 'primary');
  const file = path.join(tmp, 'primary-schools/index.html');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(`id="school-${first.id}"`, 'id="removed-record"'));
  const group = catalogCoverageMatrix(tmp, routes).groups.find(item => item.key === 'primary');
  assert.equal(group.generatedCount, 178);
  assert.equal(group.missingPageCount, 1);
  assert.match(group.nextActions.join('\n'), /检查学校库记录/);
  assert.doesNotMatch(group.nextActions.join('\n'), /生成/);
});

test('missing category sitemap coverage is one canonical-page issue, not 146 retired detail URLs', t => {
  const tmp = fixture(t);
  const matrix = catalogCoverageMatrix(tmp, routes.filter(route => !route.endsWith('/secondary-schools/')));
  const group = matrix.groups.find(item => item.key === 'secondary');
  assert.equal(group.generatedCount, 146);
  assert.equal(group.sitemapCount, 0);
  assert.equal(group.missingSitemapCount, 146);
  assert.deepEqual(group.nextActions, ['检查分类地图入口 /secondary-schools/']);
});

test('a noindex fallback is not counted as an active catalog', t => {
  const tmp = fixture(t);
  const file = path.join(tmp, 'primary-schools/index.html');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</head>', '<meta name="robots" content="noindex"></head>'));
  const group = catalogCoverageMatrix(tmp, routes).groups.find(item => item.key === 'primary');
  assert.equal(group.generatedCount, 0);
  assert.equal(group.missingPageCount, 179);
});
