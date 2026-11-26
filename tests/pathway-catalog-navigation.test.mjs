import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { distinguishPathwayCatalogNavigation, syncPathwayCatalogNavigation } from '../scripts/sync-pathway-catalog-navigation.mjs';

const html = `<header class="site-header"><nav class="main-nav"><div class="nav-group"><span class="nav-label">升学路径 <svg></svg></span><div class="mega-dropdown"><a class="active" href="/jc/">JC</a><a href="/international-school/">国际课程</a><a href="/poly/">Poly</a></div></div><div class="nav-group"><span class="nav-label">学校库 <svg></svg></span><div class="mega-dropdown"><a href="/jc/">学院</a><a href="/international-school/">国际学校</a><a href="/school-database/">全部学校</a></div></div></nav></header><main><h1>路线说明</h1><a href='/jc/'>JAE 政策</a><a href="/international-school/">申请材料</a><p>保留条件 &amp; 费用限定。</p></main><footer><a href="/jc/">政策</a></footer>`;
function groups(text) {
  const $ = load(text);
  const list = $('header .nav-group');
  return { $, pathway: list.eq(0), catalog: list.eq(1) };
}

test('pathway keeps policy destinations and gains one actual overview entry', () => {
  const { pathway } = groups(distinguishPathwayCatalogNavigation(html));
  assert.equal(pathway.find('a[href="/pathway/"]').length, 1);
  for (const route of ['/jc/', '/international-school/', '/poly/']) assert.equal(pathway.find(`a[href="${route}"]`).length, 1);
  assert.equal(pathway.find('a.active').length, 1);
});
test('catalog destinations point to school records, not repeated policy guides', () => {
  const { catalog } = groups(distinguishPathwayCatalogNavigation(html));
  for (const route of ['/school-database/jc/', '/international-school/schools/', '/school-database/']) assert.equal(catalog.find(`a[href="${route}"]`).length, 1);
  assert.equal(catalog.find('a[href="/jc/"],a[href="/international-school/"]').length, 0);
});
test('page body and footer remain byte-identical', () => {
  const result = distinguishPathwayCatalogNavigation(html);
  assert.equal(result.slice(result.indexOf('<main>')), html.slice(html.indexOf('<main>')));
});
test('repeat normalization is byte-idempotent; redirect pages and missing menus untouched', () => {
  const once = distinguishPathwayCatalogNavigation(html);
  assert.equal(distinguishPathwayCatalogNavigation(once), once);
  assert.equal(distinguishPathwayCatalogNavigation('<!-- SEDA_SCHOOL_REDIRECT -->' + html), '<!-- SEDA_SCHOOL_REDIRECT -->' + html);
  assert.equal(distinguishPathwayCatalogNavigation('<main>独立工具</main>'), '<main>独立工具</main>');
});
test('root and nested pages normalize; engineering, backup and symlink content stays untouched', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-nav-'));
  try {
    for (const file of ['index.html', 'pathway/index.html', 'school-database/index.html', 'docs/sample.html', 'data/sample.html', 'aeis_backup/index.html', '.hidden/sample.html']) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), html);
    }
    fs.symlinkSync(path.join(root, 'docs'), path.join(root, 'linked'));
    const first = syncPathwayCatalogNavigation(root);
    assert.equal(first.updated, 3);
    assert.equal(syncPathwayCatalogNavigation(root).updated, 0);
    for (const file of ['docs/sample.html', 'data/sample.html', 'aeis_backup/index.html', '.hidden/sample.html']) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), html);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('built homepage, pathway and catalog pages expose distinct real menu targets', () => {
  const root = path.resolve(import.meta.dirname, '..');
  for (const file of ['index.html', 'pathway/index.html', 'school-database/index.html', 'school-database/jc/index.html', 'international-school/schools/index.html']) {
    const $ = load(fs.readFileSync(path.join(root, file), 'utf8'));
    const menus = new Map();
    $('header .main-nav .nav-group').each((_, group) => {
      const label = $(group).children('.nav-label').clone(); label.find('svg').remove();
      menus.set(label.text().trim(), $(group));
    });
    assert.ok(menus.has('升学路径') && menus.has('学校库'), file);
    const pathway = menus.get('升学路径'); const catalog = menus.get('学校库');
    assert.equal(pathway.find('a[href="/pathway/"]').length, 1, file);
    assert.equal(pathway.find('a[href="/jc/"]').length, 1, file);
    assert.equal(pathway.find('a[href="/international-school/"]').length, 1, file);
    assert.equal(catalog.find('a[href="/school-database/jc/"]').length, 1, file);
    assert.equal(catalog.find('a[href="/international-school/schools/"]').length, 1, file);
    assert.equal(catalog.find('a[href="/jc/"],a[href="/international-school/"]').length, 0, file);
  }
});
