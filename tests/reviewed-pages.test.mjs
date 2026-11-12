import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const routes = ['aeis', 'o-level', 'wace', 'jc', 'guides/cost'];
const normalize = text => text.replace(/\s+/g, ' ').trim();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const route of routes) {
  test(route + ': reviewed content, metadata, FAQ and anchors agree', () => {
    const html = read(route + '/index.html');
    const $ = load(html);
    assert.match(html, /<!-- SEDA_CUSTOM_PAGE -->/);
    assert.equal($('h1').length, 1);
    assert.equal($('link[rel=canonical]').attr('href'), 'https://sgeda.org.cn/' + route + '/');
    assert.equal($('meta[property="og:title"]').attr('content'), $('title').text());
    assert.equal($('meta[property="og:description"]').attr('content'), $('meta[name=description]').attr('content'));
    assert.ok($('meta[name=description]').attr('content').length > 20);
    const nodes = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const schema = JSON.parse($(el).text());
      nodes.push(...(schema['@graph'] || [schema]));
    });
    const faqs = nodes.filter(n => n['@type'] === 'FAQPage');
    assert.equal(faqs.length, 1, 'one authoritative FAQ');
    $('script, style, nav, header, footer').remove();
    const text = normalize($('body').text());
    for (const q of faqs[0].mainEntity) {
      assert.ok(text.includes(normalize(q.name)), q.name);
      assert.ok(text.includes(normalize(q.acceptedAnswer.text)), q.name + ' answer mismatch');
    }
    assert.ok($('#contact a[href="/contact/"], #contact a[href^="https://wa.me/"]').length > 0, 'actionable consultation');
    $('a[href^="#"]').each((_, el) => {
      const id = $(el).attr('href').slice(1);
      if (id) assert.ok($('[id]').toArray().some(node => $(node).attr('id') === id), 'missing anchor ' + id);
    });
    $('img[src^="/"]').each((_, el) => assert.ok(fs.existsSync(path.join(root, $(el).attr('src'))), $(el).attr('src')));
  });
}

test('known misleading admission and pricing claims cannot return', () => {
  const all = routes.map(route => read(route + '/index.html')).join('\n');
  assert.doesNotMatch(all, /无论成绩如何都会被录取|仅限当年\s*AEIS\s*未通过者|L1R5\s*计算方式不变|Total Estimated ATAR|全部 42 所|达 D7 即可获 2 分|S\$15k-65k/);
  assert.match(read('aeis/index.html'), /P2–P4/);
  assert.match(read('o-level/index.html'), /2028.*L1R4/);
  assert.match(read('wace/index.html'), /Tertiary Entrance Aggregate/);
  assert.doesNotMatch(read('scripts/enhance-key-seo-pages.mjs'), /file: 'aeis\/index.html'/);
});
