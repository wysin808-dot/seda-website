import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';

const root = new URL('../', import.meta.url);
const $ = load(fs.readFileSync(new URL('index.html', root), 'utf8'));

test('visual homepage keeps crawlable entry points and existing destinations', () => {
  assert.equal($('h1').length, 1);
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://sgeda.org.cn/');
  for (const path of ['/o-level/', '/aeis/', '/wace/', '/pathway/', '/school-database/', '/contact/']) {
    assert.ok($(`main a[href="${path}"]`).length, path);
  }
  $('main a[href^="/"]').each((_, a) => {
    const path = $(a).attr('href').split('#')[0];
    assert.ok(fs.existsSync(new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, root)), path);
  });
  $('main a[href^="#"]').each((_, a) => assert.equal($($(a).attr('href')).length, 1));
  assert.equal($('.home-pathways > a').length, 4);
  assert.ok($('main').text().includes('2027'));
});

test('homepage photos have local assets, alt text and reserved dimensions', () => {
  assert.equal($('.home-photo-card img').length, 6);
  $('main img').each((_, img) => {
    const el = $(img);
    assert.ok(fs.existsSync(new URL(`.${el.attr('src')}`, root)));
    assert.ok(el.attr('alt'));
    assert.ok(Number(el.attr('width')) > 0 && Number(el.attr('height')) > 0);
    if (!el.hasClass('home-hero-image')) assert.equal(el.attr('loading'), 'lazy');
  });
  assert.equal($('.home-hero-image').attr('fetchpriority'), 'high');
});

test('FAQ structured data matches the visible questions and answers', () => {
  const schema = $('script[type="application/ld+json"]').toArray()
    .map(el => JSON.parse($(el).text())).find(data => data['@type'] === 'FAQPage');
  const details = $('.home-faq-list details').toArray();
  assert.equal(schema.mainEntity.length, details.length);
  const normalize = text => text.replace(/\s+/g, '');
  details.forEach((el, i) => {
    assert.equal(schema.mainEntity[i].name, $(el).find('summary').text());
    assert.equal(normalize(schema.mainEntity[i].acceptedAnswer.text), normalize($(el).find('p').text()));
  });
});
