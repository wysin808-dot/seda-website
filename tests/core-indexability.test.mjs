import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';
import { SITE, baiduAllowed, inspectPage, parseSitemap } from '../scripts/seo-pages.mjs';

const root = new URL('../', import.meta.url);
const routes = ['/', '/aeis/', '/o-level/', '/wace/', '/ossd/', '/university/', '/university/nus/', '/university/ntu/', '/jc/', '/guides/cost/'];
const allowed = baiduAllowed(fs.readFileSync(new URL('robots.txt', root), 'utf8'));
const sitemap = new Set(parseSitemap(fs.readFileSync(new URL('sitemap.xml', root), 'utf8')).map(e => e.url));
const home = load(fs.readFileSync(new URL('index.html', root), 'utf8'));

for (const route of routes) {
  test(`${route}: core page stays crawlable with static content`, () => {
    const url = SITE + route;
    const html = fs.readFileSync(new URL(`.${route}index.html`, root), 'utf8');
    const $ = load(html);
    assert.equal(allowed(url), true, 'Baiduspider must be allowed');
    assert.ok(sitemap.has(url), 'Full sitemap must include core route');
    assert.deepEqual(inspectPage(html, url).issues, []);
    assert.equal($('head > title').length, 1);
    assert.equal($('h1').length, 1);
    $('script, style, svg, header, footer, nav').remove();
    assert.ok($('body').text().replace(/\s/g, '').length > 300, 'Core content must exist without running JavaScript');
    assert.ok(home(`a[href="${route}"]`).length, 'Homepage must link to the core page');
  });
}
