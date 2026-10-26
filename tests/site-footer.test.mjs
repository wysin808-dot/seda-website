import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { syncSiteFooter } from '../scripts/sync-site-footer.mjs';

test('footer sync preserves page content, versions CSS, and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-footer-test-'));
  try {
    const footer = '<footer class="site-footer"><p>Shared footer</p></footer>';
    fs.writeFileSync(path.join(root, 'index.html'), `<link rel="stylesheet" href="/seda-site.css?v=44">${footer}`);
    fs.mkdirSync(path.join(root, 'course'));
    const main = '<main><h1>Independent page</h1><p data-custom="yes">Keep this exactly.</p></main>';
    fs.writeFileSync(path.join(root, 'course/index.html'), `<link href='/seda-site.css?v=1' rel="stylesheet">${main}<footer class="site-footer old"><p>Old</p></footer>`);
    fs.mkdirSync(path.join(root, 'cms'));
    fs.writeFileSync(path.join(root, 'cms/index.html'), '<footer class="site-footer">Private CMS footer</footer>');
    fs.writeFileSync(path.join(root, 'verification.html'), 'verification text');
    assert.deepEqual(syncSiteFooter(root), { checked: 2, updated: 1 });
    const result = fs.readFileSync(path.join(root, 'course/index.html'), 'utf8');
    assert.ok(result.includes(main));
    assert.ok(result.endsWith(footer));
    assert.ok(result.includes('href="/seda-site.css?v=44"'));
    assert.equal(fs.readFileSync(path.join(root, 'verification.html'), 'utf8'), 'verification text');
    assert.equal(fs.readFileSync(path.join(root, 'cms/index.html'), 'utf8'), '<footer class="site-footer">Private CMS footer</footer>');
    assert.deepEqual(syncSiteFooter(root), { checked: 2, updated: 0 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('shared footer has real destinations, a brand image, and valid contact links', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const $ = load(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const footer = $('footer.site-footer');
  assert.equal(footer.length, 1);
  assert.equal(footer.find('nav[aria-label]').length, 2);
  assert.equal(footer.find('a[href="tel:+6580847715"]').length, 1);
  assert.equal(footer.find('a[href="mailto:admin@seda.org.sg"]').length, 1);
  assert.match(footer.find('.icp-record').text(), /京ICP备2026066750号-1/);
  for (const link of footer.find('a[href^="/"]').toArray()) {
    const href = $(link).attr('href');
    assert.ok(fs.existsSync(path.join(root, href, 'index.html')), `Missing footer destination ${href}`);
  }
  const image = footer.find('img');
  assert.equal(image.attr('alt'), 'SEDA 新加坡择校网');
  assert.ok(fs.existsSync(path.join(root, image.attr('src'))));
});

test('custom pages share the homepage footer without inline layout overrides', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const home = load(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const expected = home('footer.site-footer').html();
  for (const file of ['o-level/index.html', 'jc/index.html', 'university/nus/index.html', 'wace/what-is/index.html', 'aeis/grade-checker/index.html', 'pathway/poly-matcher/index.html', 'hk-university/index.html']) {
    const $ = load(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.equal($('footer.site-footer').html(), expected, file);
    assert.equal($('link[href="/seda-site.css?v=44"]').length, 1, file);
    assert.doesNotMatch($('style').text(), /\.site-footer\b/, file);
  }
});
