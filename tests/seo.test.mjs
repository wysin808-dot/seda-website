import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectBatch, recordAccepted } from '../scripts/baidu-queue.mjs';
import { partitionArticles, prepareArticleHtml } from '../scripts/content-validation.mjs';
import { SITE, baiduAllowed, inspectPage, parseSitemap, sitemapXml, localFile } from '../scripts/seo-pages.mjs';
import { mergeContent } from '../scripts/restore-cms-content.mjs';

const now = new Date('2026-09-07T06:00:00Z');
const page = (name, modified = '2026-09-01', fingerprint = name) => ({ url: SITE + '/' + name + '/', modified, fingerprint, issues: [] });
test('new pages rotate after acceptance instead of repeating the first five', () => {
  const pages = Array.from({ length: 12 }, (_, i) => page(String(i)));
  const state = {}, batch = selectBatch(pages, state, 5, [], now);
  assert.equal(batch.length, 5);
  assert.equal(recordAccepted(state, batch, { ok: true, response: { success: 5, remain: 0 } }, now), true);
  assert.ok(selectBatch(pages, state, 5, [], now).every(p => !batch.includes(p)));
});
test('failure, over quota and partial success do not advance URLs', () => {
  const state = {}, batch = [page('a'), page('b')];
  for (const result of [{ ok: false, response: { error: 400, message: 'over quota' } }, { ok: true, response: { success: 1 } }]) {
    assert.equal(recordAccepted(state, batch, result, now), false);
    assert.deepEqual(state, {});
  }
});
test('changed pages and newest articles precede older untouched content', () => {
  const pages = [page('old'), page('new', '2026-09-06'), page('fixed', '2026-08-01', 'new-hash')];
  const state = { [pages[2].url]: { fingerprint: 'old-hash', submittedAt: now.toISOString() } };
  assert.deepEqual(selectBatch(pages, state, 2, [], now).map(p => p.url), [pages[2].url, pages[1].url]);
});
test('a priority URL does not bypass health checks or repeat successful unchanged content', () => {
  const healthy = page('a'), broken = { ...page('b'), issues: ['noindex'] };
  const state = { [healthy.url]: { fingerprint: healthy.fingerprint, submittedAt: now.toISOString() } };
  assert.deepEqual(selectBatch([healthy, broken], state, 5, [healthy.url, broken.url], now), []);
});
test('unchanged content becomes eligible for recrawl only after 30 days', () => {
  const p = page('a');
  assert.equal(selectBatch([p], { [p.url]: { fingerprint: p.fingerprint, submittedAt: '2026-08-01T00:00:00Z' } }, 5, [], now).length, 1);
});
test('draft cleanup excludes URLs belonging to published articles', () => {
  const published = { url: '/aeis/writing/', meta: { draft: false } };
  const draft = { url: published.url, meta: { draft: true } };
  assert.deepEqual(partitionArticles([draft, published]), { published: [published], drafts: [] });
  assert.throws(() => partitionArticles([published, published]), /Duplicate published/);
});
test('robots honors approved exceptions without opening blocked school pages', () => {
  const allow = baiduAllowed('User-agent: Baiduspider\nDisallow: /jc/*/\nAllow: /jc/raffles/\n');
  assert.equal(allow(SITE + '/jc/'), true);
  assert.equal(allow(SITE + '/jc/raffles/'), true);
  assert.equal(allow(SITE + '/jc/blocked/'), false);
  assert.equal(allow('https://other.example/jc/'), false);
});
test('sitemap parser supports one entry, empty lists and XML entities', () => {
  const entries = [{ url: SITE + '/test/?a=1&b=2', lastmod: '2026-09-07' }];
  assert.deepEqual(parseSitemap(sitemapXml(entries)), entries);
  assert.deepEqual(parseSitemap(sitemapXml([])), []);
  assert.throws(() => parseSitemap('<urlset><url></urlset>'), /Invalid/);
});
test('HTML inspection ignores anchors inside scripts and detects noindex', () => {
  const html = `<title>Test</title><meta name="description" content="Text"><link rel="canonical" href="${SITE}/test/"><meta name="robots" content="noindex"><main><h1>Test</h1><a href="/real/">Real</a></main><script>const x = '<a href="/fake/">fake</a>';</script>`;
  const result = inspectPage(html, SITE + '/test/');
  assert.deepEqual(result.links, [SITE + '/real/']);
  assert.ok(result.issues.includes('noindex'));
});
test('related article updates do not invalidate every article fingerprint', () => {
  const html = text => `<main><h1>Stable</h1><p>Body</p><section class="related-section">${text}</section></main>`;
  assert.equal(inspectPage(html('old'), SITE).fingerprint, inspectPage(html('new'), SITE).fingerprint);
  assert.notEqual(inspectPage('<main><a href="/a/">Link</a></main>', SITE).fingerprint, inspectPage('<main><a href="/b/">Link</a></main>', SITE).fingerprint);
});
test('local file resolution rejects traversal and external paths', () => {
  assert.equal(localFile('/tmp/site', 'https://external.example/a/'), null);
  assert.throws(() => localFile('/tmp/site', SITE + '/%2e%2e%2foutside/'), /Invalid/);
});
test('article repair links to published routes and leaves drafts as plain text', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-test-'));
  try {
    const a = { file: 'a.md', url: '/aeis/source/', meta: {}, html: '<p><a href="/aeis/target/">Target</a> <a href="/aeis/draft/">Draft</a></p><img src="/missing.png">' };
    const all = [a, { url: '/aeis/aeis-target/', meta: {} }, { url: '/aeis/draft/', meta: { draft: true } }];
    const policy = { aliases: {}, unavailableLinks: [], missingImages: ['/missing.png'] };
    const html = prepareArticleHtml(a, all, root, policy);
    assert.ok(html.includes('href="/aeis/aeis-target/"'));
    assert.ok(!html.includes('href="/aeis/draft/"'));
    assert.ok(!html.includes('<img'));
    const noSlash = prepareArticleHtml({ ...a, html: '<a href="/aeis/aeis-target?mode=1#section">Target</a><a href="/aeis/draft">Draft</a>' }, all, root, policy);
    assert.ok(noSlash.includes('href="/aeis/aeis-target/?mode=1#section"'));
    assert.ok(!noSlash.includes('href="/aeis/draft'));
    assert.throws(() => prepareArticleHtml({ ...a, html: '<img src="/new-missing.png">' }, all, root, policy), /missing image/);
    assert.throws(() => prepareArticleHtml({ ...a, html: '<a href="/new-missing/">x</a>' }, all, root, policy), /missing link/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('CMS restore retains incoming corrections and independent server edits', () => {
  assert.equal(mergeContent('old', 'old', 'fixed'), 'fixed');
  assert.equal(mergeContent('old', 'CMS', 'old'), 'CMS');
  assert.equal(mergeContent(null, 'new CMS file', null), 'new CMS file');
  const base = 'draft: false\n\nTitle\n\nBody\n\nOld policy\n';
  assert.equal(mergeContent(base, base.replace('false', 'true'), base.replace('Old policy', 'Correct policy')), base.replace('false', 'true').replace('Old policy', 'Correct policy'));
  assert.throws(() => mergeContent('old\n', 'CMS\n', 'GitHub\n'), /changed the same/);
});
