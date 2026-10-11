import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';

const root = new URL('../', import.meta.url);

test('home keeps news navigation without a stale latest-articles section', () => {
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  const $ = load(html);
  assert.equal($('.latest-articles-section').length, 0);
  assert.doesNotMatch(html, /HOME_LATEST_ARTICLES|最新升学攻略与数据解读/);
  assert.ok($('header a[href="/news/"]').length);
  assert.ok($('footer a[href="/news/"]').length);
});

test('content build still updates news and feeds but cannot reinsert home articles', () => {
  const build = fs.readFileSync(new URL('scripts/build-content.mjs', root), 'utf8');
  assert.doesNotMatch(build, /updateHomeLatestArticles|HOME_LATEST_ARTICLES/);
  assert.match(build, /updateNewsIndex\(articles\);/);
  assert.match(build, /writeFeeds\(articles\);/);
  const news = fs.readFileSync(new URL('news/index.html', root), 'utf8');
  assert.match(news, /GENERATED_ARTICLES_START/);
  assert.match(news, /GENERATED_ARTICLES_END/);
});
