import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { prepareArticleHtml } from '../scripts/content-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = { aliases: {}, unavailableLinks: [], missingImages: [] };

function fixture(t, html) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-custom-link-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'guides/accommodation'), { recursive: true });
  fs.writeFileSync(path.join(root, 'guides/accommodation/index.html'), html);
  const published = {
    file: 'content/articles/o-level-apply-overseas-high-school.md',
    meta: { draft: false, date: '2026-08-29' },
    url: '/o-level/o-level-apply-overseas-high-school/',
    body: 'Published source remains unchanged.',
    html: '<p><a href="/guides/accommodation/">新加坡学生住宿怎么选</a></p>',
  };
  const draft = { file: 'content/articles/guides-accommodation.md', meta: { draft: true }, url: '/guides/accommodation/', body: 'Unreviewed CMS draft.' };
  return { root, published, all: [published, draft] };
}

test('existing real indexable custom accommodation page wins over a same-URL draft', t => {
  const html = fs.readFileSync(path.join(ROOT, 'guides/accommodation/index.html'), 'utf8');
  assert.ok(html.includes('<!-- SEDA_CUSTOM_PAGE -->'));
  const f = fixture(t, html);
  const output = prepareArticleHtml(f.published, f.all, f.root, policy);
  assert.equal(output, f.published.html, 'Published anchor and body must not change');
});

test('ordinary draft output is still unlinked even when its file exists', t => {
  const f = fixture(t, '<html><head><meta name="robots" content="noindex,nofollow"></head><body><h1>Draft</h1></body></html>');
  const $ = load(prepareArticleHtml(f.published, f.all, f.root, policy), null, false);
  assert.equal($('a').length, 0);
  assert.equal($('p').text(), '新加坡学生住宿怎么选');
});

test('a custom marker does not make a noindex draft a public link target', t => {
  const f = fixture(t, '<!-- SEDA_CUSTOM_PAGE --><html><head><meta name="robots" content="index,follow"><meta name="robots" content="noindex,nofollow"></head><body><h1>Draft</h1></body></html>');
  const $ = load(prepareArticleHtml(f.published, f.all, f.root, policy), null, false);
  assert.equal($('a').length, 0);
});

for (const [name, content] of [['ROBOTS', 'noindex,nofollow'], ['robots', 'none']]) {
  test(`custom marker remains nonpublic for ${name}=${content}`, t => {
    const f = fixture(t, `<!-- SEDA_CUSTOM_PAGE --><html><head><meta name="${name}" content="${content}"></head><body><h1>Draft</h1></body></html>`);
    const $ = load(prepareArticleHtml(f.published, f.all, f.root, policy), null, false);
    assert.equal($('a').length, 0);
  });
}

test('slash normalization, query and fragment retain the existing custom destination', t => {
  const f = fixture(t, fs.readFileSync(path.join(ROOT, 'guides/accommodation/index.html'), 'utf8'));
  f.published.html = '<p><a href="/guides/accommodation?source=article#housing">住宿</a></p>';
  const $ = load(prepareArticleHtml(f.published, f.all, f.root, policy), null, false);
  assert.equal($('a').attr('href'), '/guides/accommodation/?source=article#housing');
  assert.equal($('a').text(), '住宿');
});
