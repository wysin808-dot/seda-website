import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { DATABASE_CATEGORIES, renderSchoolDatabase, buildSchoolDatabase, safeWebsite, safeDetailUrl } from '../scripts/build-school-database.mjs';
import { filterSchools, schoolIdFromHash, transitionSchoolState, initSchoolDatabase } from '../assets/school-database.js';

const root = path.resolve(import.meta.dirname, '..');
const fixtureRecord = (category, suffix, extra = {}) => ({
  id: `${category}-${suffix}`, category, nameZh: `测试${category}学校${suffix}`, nameEn: `Fixture ${category} school ${suffix}`,
  location: '', schoolType: '', curriculum: '', website: '', majorAreas: [], admissionPaths: [], detailUrl: '', legacyUrls: [], ...extra,
});
const fixtures = DATABASE_CATEGORIES.map(category => fixtureRecord(category.id, 'one'));
fixtures[0] = fixtureRecord('primary', 'one', {
  nameZh: '测试光华小学', nameEn: 'Fixture Primary One', schoolType: '政府小学',
  location: 'North 测试区域', curriculum: '小学课程', website: 'https://primary.example/',
});
fixtures[1] = fixtureRecord('secondary', 'one', {
  nameZh: '测试中学', nameEn: 'Fixture Secondary One', schoolType: '政府中学',
  location: 'East 测试区域', curriculum: 'SEC',
});
fixtures[2] = fixtureRecord('international', 'one', {
  nameZh: '测试国际学校', nameEn: 'Fixture International One', schoolType: '国际学校',
  location: 'East 测试区域', curriculum: 'IB / IGCSE', website: 'https://international.example/',
});
fixtures[6] = fixtureRecord('university', 'one', {
  nameZh: '测试大学', nameEn: 'Fixture University One', schoolType: '大学', curriculum: '本科',
  majorAreas: ['测试工程学', '测试设计学'], admissionPaths: ['测试 A-Level 申请路径', '测试国际文凭申请路径'],
  detailUrl: '/university/fixture-university/', legacyUrls: ['/university/fixture-university/'],
});
const render = (records = fixtures, options = {}) => renderSchoolDatabase(records, options);
const schemas = $ => $('script[type="application/ld+json"]').toArray().map(node => JSON.parse($(node).text()));

// Cheerio-backed minimal browser adapter exercises the real DOM initializer without installing
// dependencies, making network requests, starting a browser, or writing actual site pages.
function isolatedDOM(html, url = 'https://sgeda.org.cn/school-database/') {
  const $ = load(html);
  const cache = new WeakMap();
  let activeElement = null;
  function wrap(node) {
    if (!node) return null;
    if (cache.has(node)) return cache.get(node);
    const element = {
      dataset: new Proxy({}, { get: (_, key) => $(node).attr('data-' + String(key).replace(/[A-Z]/g, char => '-' + char.toLowerCase())) }),
      listeners: new Map(),
      querySelector: selector => wrap($(node).find(selector).get(0)),
      querySelectorAll: selector => $(node).find(selector).toArray().map(wrap),
      setAttribute: (key, val) => $(node).attr(key, String(val)),
      removeAttribute: key => $(node).removeAttr(key),
      getAttribute: key => $(node).attr(key) ?? null,
      addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); },
      removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); },
      fire(type, extra = {}) {
        const event = { currentTarget: element, target: element, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
        for (const callback of this.listeners.get(type) || []) callback(event);
        return event;
      },
      focus() { activeElement = element; },
      classList: {
        contains: name => $(node).hasClass(name),
        add: name => $(node).addClass(name),
        remove: name => $(node).removeClass(name),
      },
    };
    Object.defineProperties(element, {
      hidden: { get: () => $(node).attr('hidden') !== undefined, set: val => val ? $(node).attr('hidden', '') : $(node).removeAttr('hidden') },
      textContent: { get: () => $(node).text(), set: val => $(node).text(val) },
      value: { get: () => element._value ?? $(node).attr('value') ?? '', set: val => { element._value = String(val); } },
    });
    cache.set(node, element);
    return element;
  }
  let current = new URL(url);
  const entries = [current.href];
  let cursor = 0;
  const windowListeners = new Map();
  const browser = {
    get location() { return current; },
    addEventListener(type, callback) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(callback); },
    removeEventListener(type, callback) { windowListeners.get(type)?.delete(callback); },
    fire(type) { for (const callback of windowListeners.get(type) || []) callback({ type }); },
    history: {
      pushState(_, __, target) { current = new URL(target, current); entries.splice(++cursor); entries.push(current.href); },
      replaceState(_, __, target) { current = new URL(target, current); entries[cursor] = current.href; },
      back() { if (cursor > 0) { current = new URL(entries[--cursor]); browser.fire('popstate'); browser.fire('hashchange'); } },
      forward() { if (cursor < entries.length - 1) { current = new URL(entries[++cursor]); browser.fire('popstate'); browser.fire('hashchange'); } },
      get length() { return entries.length; },
    },
    navigateHash(fragment) { current = new URL(fragment || current.pathname, current); browser.fire('hashchange'); },
  };
  return { $, browser, root: wrap($('[data-school-database]').get(0)), element: selector => wrap($(selector).get(0)), get activeElement() { return activeElement; } };
}

test('raw HTML contains every record, both names, actual facts and existing lists without JS', () => {
  const $ = load(render());
  assert.equal($('[data-school-record]').length, fixtures.length);
  assert.equal($('[data-school-record][hidden]').length, 0);
  assert.equal($('[data-school-database]').hasClass('is-enhanced'), false);
  assert.equal($('[data-school-controls][hidden]').length, 1);
  assert.equal($('noscript').text().includes('浏览器'), true);
  assert.equal($('[data-school-select]').length, fixtures.length);
  for (const record of fixtures) {
    const body = $(`#school-${record.id}`).text();
    for (const value of [record.nameZh, record.nameEn, record.schoolType, record.location, record.curriculum, ...record.majorAreas, ...record.admissionPaths].filter(Boolean)) assert.ok(body.includes(value), value);
    assert.equal($(`#school-${record.id}`).length, 1);
    assert.equal($(`[data-school-select="${record.id}"]`).attr('href'), `#school-${record.id}`);
  }
  assert.equal($('#school-university-one .sdb-read-more a').attr('href'), fixtures[6].detailUrl);
  assert.equal($('#school-primary-one .sdb-read-more').length, 0);
  assert.equal($('#school-private-one .sdb-missing').text().includes('尚未收录'), true);
  assert.equal($('a[href="https://primary.example/"]').length, 1);
  assert.doesNotMatch($.html(), /SEDA_SOURCES|FAQPage|Article|Tier|\bCOP\b|排名|学费|核实日期|官方来源/);
  assert.match($.html(), /<!-- SEDA_SCHOOL_DATABASE -->/);
  assert.equal($('.contact-section a').attr('href'), '/contact/');
});

test('all seven categories have independent metadata, actual content, navigation and unique record hashes', () => {
  const titles = new Set();
  const descriptions = new Set();
  const routes = [{ id: null, route: '/school-database/' }, ...DATABASE_CATEGORIES];
  for (const category of routes) {
    const $ = load(render(fixtures, { category: category.id }));
    const shown = category.id ? fixtures.filter(record => record.category === category.id) : fixtures;
    assert.equal($('html').attr('lang'), 'zh-CN');
    assert.equal($('h1').length, 1);
    assert.equal($('[data-school-record]').length, shown.length);
    assert.equal($('.sdb-category-nav a').length, 8);
    assert.equal($('.sdb-category-nav [aria-current="page"]').attr('href'), category.route);
    assert.equal($('link[rel="canonical"]').attr('href'), 'https://sgeda.org.cn' + category.route);
    assert.equal($('meta[property="og:url"]').attr('content'), $('link[rel="canonical"]').attr('href'));
    assert.equal($('meta[property="og:title"]').attr('content'), $('title').text());
    assert.equal($('meta[name="twitter:title"]').attr('content'), $('title').text());
    for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) assert.equal($(selector).attr('content'), $('meta[name="description"]').attr('content'));
    for (const selector of ['meta[property="og:type"]', 'meta[property="og:image"]', 'meta[property="og:site_name"]', 'meta[name="twitter:card"]', 'meta[name="twitter:image"]']) assert.ok($(selector).attr('content'));
    assert.equal($('link[rel="icon"]').attr('href'), '/assets/favicon.svg');
    titles.add($('title').text());
    descriptions.add($('meta[name="description"]').attr('content'));
    const ids = $('[id]').toArray().map(node => $(node).attr('id'));
    assert.equal(new Set(ids).size, ids.length);
    $('a[href^="#"]').each((_, node) => assert.ok(ids.includes($(node).attr('href').slice(1))));
    for (const record of fixtures.filter(record => !shown.includes(record))) assert.equal($(`#school-${record.id}`).length, 0);
  }
  assert.equal(titles.size, 8);
  assert.equal(descriptions.size, 8);
});

test('CollectionPage / ItemList / School describe exactly the visible records, not invented claims', () => {
  for (const category of [null, ...DATABASE_CATEGORIES.map(item => item.id)]) {
    const $ = load(render(fixtures, { category }));
    const [schema] = schemas($);
    const shown = fixtures.filter(record => !category || record.category === category);
    assert.equal(schemas($).length, 1);
    assert.equal(schema['@type'], 'CollectionPage');
    assert.equal(schema.name, $('h1').text());
    assert.equal(schema.description, $('meta[name="description"]').attr('content'));
    assert.equal(schema.mainEntity['@type'], 'ItemList');
    assert.equal(schema.mainEntity.numberOfItems, shown.length);
    for (const [index, entry] of schema.mainEntity.itemListElement.entries()) {
      const record = shown[index];
      const categoryRoute = DATABASE_CATEGORIES.find(item => item.id === record.category).route;
      assert.equal(entry.position, index + 1);
      assert.equal(entry.item['@type'], 'School');
      assert.equal(entry.item.name, $(`#school-title-${record.id}`).text());
      assert.equal(entry.url, `https://sgeda.org.cn${categoryRoute}#school-${record.id}`);
      assert.equal(entry.item.url, entry.url);
      assert.equal(entry.item.alternateName, record.nameEn);
      if (entry.item.description) for (const part of entry.item.description.split('；')) assert.ok($(`#school-${record.id}`).text().includes(part));
      assert.equal(entry.item.dateModified, undefined);
      assert.equal(entry.item.aggregateRating, undefined);
      assert.equal(entry.item.offers, undefined);
      assert.equal(entry.item.educationalCredentialAwarded, undefined);
    }
    assert.equal(schema.dateModified, undefined);
    assert.doesNotMatch(JSON.stringify(schema), /FAQPage|Article|Tier|COP|排名|学费|rating/);
  }
});

test('malicious quote data is escaped in text, attributes, options and JSON-LD; unsafe URLs never become hrefs', () => {
  const dangerous = `测试" onfocus="alert(1) ' & <img src=x onerror=alert(1)> </script><script>alert(1)</script>`;
  const bad = fixtureRecord('primary', 'quoted', {
    nameZh: dangerous, nameEn: `Fixture "quoted" & 'name'`, schoolType: dangerous,
    location: dangerous, curriculum: dangerous, majorAreas: [dangerous], admissionPaths: [dangerous],
    website: 'https://school.example/" onclick="alert(1)', detailUrl: '/primary-schools/test/" onclick="alert(1)',
  });
  const html = render([bad]);
  const $ = load(html);
  assert.equal($('img, iframe, script:not([type="application/ld+json"]):not([src])').length, 0);
  assert.equal($('[onfocus],[onerror],[onclick]').length, 0);
  assert.equal($('#school-title-primary-quoted').text(), dangerous);
  assert.equal($('#school-primary-quoted').attr('data-name-zh'), dangerous);
  assert.equal($('#school-location option').last().attr('value'), dangerous);
  assert.equal($('#school-primary-quoted a').length, 0);
  assert.equal(schemas($)[0].mainEntity.itemListElement[0].item.name, dangerous);
  assert.doesNotMatch($('script[type="application/ld+json"]').text(), /<|>/);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//evil.example/', 'https://u:p@school.example/', 'https://school.example/\nfoo', 'https://school.example/"bad', 'https://school.example/<bad>', 'https:\\evil.example']) assert.equal(safeWebsite(url), '', url);
  for (const url of ['javascript:alert(1)', '//evil.example/', '/foo/../bar/', '/foo/%2e%2e/', '/foo/?id=1', '/foo/"bad/']) assert.equal(safeDetailUrl(url), '', url);
  assert.equal(safeWebsite('https://school.example/path?a=1&b=2'), 'https://school.example/path?a=1&b=2');
  const good = load(render([fixtureRecord('primary', 'good', { website: 'https://school.example/path?a=1&b=2' })]));
  assert.equal(good('a[href^="https://school.example"]').attr('href'), 'https://school.example/path?a=1&b=2');
  assert.throws(() => render([fixtureRecord('primary', 'bad" onclick="x')]), /id/);
  assert.throws(() => render([fixtures[0], fixtures[0]]), /重复/);
});

test('filtering handles Chinese, English, types, courses, existing location values and true zero results', () => {
  assert.deepEqual(filterSchools(fixtures, { query: '光华' }).map(record => record.id), ['primary-one']);
  assert.deepEqual(filterSchools(fixtures, { query: 'FIXTURE secondary' }).map(record => record.id), ['secondary-one']);
  assert.deepEqual(filterSchools(fixtures, { query: '政府中学' }).map(record => record.id), ['secondary-one']);
  assert.deepEqual(filterSchools(fixtures, { query: 'ＩＢ' }).map(record => record.id), ['international-one']);
  assert.equal(filterSchools(fixtures, { query: '不存在' }).length, 0);
  assert.deepEqual(filterSchools(fixtures, { location: 'East 测试区域' }).map(record => record.id), ['secondary-one', 'international-one']);
  assert.equal(filterSchools(fixtures, { location: '编造区域' }).length, 0);
  const $ = load(render());
  assert.deepEqual($('#school-location option').toArray().map(node => $(node).attr('value')).filter(Boolean).sort(), [...new Set(fixtures.map(record => record.location).filter(Boolean))].sort());
});

test('pure selection resets incompatible local filters, chooses first match, and handles missing hashes safely', () => {
  let state = transitionSchoolState(fixtures, {}, { type: 'init', hash: '#school-international-one' });
  assert.equal(state.selectedId, 'international-one');
  state = transitionSchoolState(fixtures, state, { type: 'filter', query: 'Fixture', location: 'East 测试区域' });
  state = transitionSchoolState(fixtures, state, { type: 'hash', hash: '#school-secondary-one' });
  assert.equal(state.query, 'Fixture', 'a matching deep link does not unnecessarily reset local search');
  assert.equal(state.location, 'East 测试区域');
  assert.equal(state.selectedId, 'secondary-one');
  state = transitionSchoolState(fixtures, state, { type: 'reset' });
  state = transitionSchoolState(fixtures, state, { type: 'filter', query: '政府小学' });
  assert.equal(state.selectedId, 'primary-one');
  state = transitionSchoolState(fixtures, state, { type: 'filter', query: '没有此校' });
  assert.equal(state.selectedId, null);
  assert.equal(state.resultIds.length, 0);
  state = transitionSchoolState(fixtures, state, { type: 'hash', hash: '#school-secondary-one' });
  assert.equal(state.query, '');
  assert.equal(state.location, '');
  assert.equal(state.selectedId, 'secondary-one');
  state = transitionSchoolState(fixtures, state, { type: 'hash', hash: '#school-not-in-category' });
  assert.equal(state.selectedId, 'primary-one');
  assert.match(state.notice, /未找到/);
  for (const hash of ['#school-', '#school-../x', '#school-a"onclick', '#%E0%A4%A', '#not-school']) assert.equal(schoolIdFromHash(hash), null);
  assert.equal(schoolIdFromHash('#school-primary-one'), 'primary-one');
  assert.equal(schoolIdFromHash('#school-primary%2Done'), 'primary-one');
  assert.equal(transitionSchoolState([], {}, { type: 'init', hash: '#school-primary-one' }).selectedId, null);
});

test('actual DOM enhancement selects every school, filters, clears stale panels and supports hash back/forward', () => {
  const dom = isolatedDOM(render(), 'https://sgeda.org.cn/school-database/#school-secondary-one');
  const controller = initSchoolDatabase(dom.root, dom.browser);
  assert.equal(dom.root.classList.contains('is-enhanced'), true);
  assert.equal(dom.element('[data-school-controls]').hidden, false);
  assert.equal(controller.getState().selectedId, 'secondary-one');
  assert.equal(dom.$('[data-school-record]:not([hidden])').length, 1);
  assert.equal(dom.element('[data-school-select="secondary-one"]').getAttribute('aria-current'), 'true');
  assert.equal(initSchoolDatabase(dom.root, dom.browser), null);
  dom.element('[data-school-select="international-one"]').fire('click');
  assert.equal(dom.browser.location.hash, '#school-international-one');
  assert.equal(dom.browser.history.length, 2);
  assert.equal(dom.activeElement, dom.element('#school-international-one'));
  dom.browser.history.back();
  assert.equal(controller.getState().selectedId, 'secondary-one');
  dom.browser.history.forward();
  assert.equal(controller.getState().selectedId, 'international-one');
  assert.equal(dom.browser.history.length, 2);
  for (const record of fixtures) {
    dom.element(`[data-school-select="${record.id}"]`).fire('click');
    assert.equal(controller.getState().selectedId, record.id);
    assert.equal(dom.$('[data-school-record]:not([hidden])').attr('id'), `school-${record.id}`);
  }
  const search = dom.element('#school-search');
  search.value = '政府小学';
  search.fire('input');
  assert.equal(controller.getState().selectedId, 'primary-one');
  assert.equal(dom.browser.location.hash, '#school-primary-one');
  assert.equal(dom.$('[data-school-list-item]:not([hidden])').length, 1);
  search.value = '完全无结果';
  search.fire('input');
  assert.equal(dom.$('[data-school-record]:not([hidden])').length, 0);
  assert.equal(dom.$('[data-school-select][aria-current]').length, 0);
  assert.equal(dom.element('[data-school-empty]').hidden, false);
  assert.match(dom.element('[data-school-result-count]').textContent, /^0 所/);
  assert.equal(dom.browser.location.hash, '');
  dom.browser.navigateHash('#school-international-one');
  assert.equal(controller.getState().selectedId, 'international-one');
  assert.equal(search.value, '');
  assert.equal(dom.element('[data-school-empty]').hidden, true);
  dom.element('#school-location').value = 'North 测试区域';
  dom.element('#school-location').fire('change');
  assert.equal(controller.getState().selectedId, 'primary-one');
  dom.browser.navigateHash('#school-secondary-one');
  assert.equal(dom.element('#school-location').value, '');
  assert.equal(controller.getState().selectedId, 'secondary-one');
  dom.browser.navigateHash('#school-unknown');
  assert.equal(dom.browser.location.hash, '#school-unknown', 'invalid fragment is not rewritten or redirected');
  assert.equal(dom.element('[data-school-hash-notice]').hidden, false);
  assert.equal(controller.getState().selectedId, 'primary-one');
  dom.element('[data-school-reset]').fire('click');
  assert.equal(dom.element('[data-school-hash-notice]').hidden, true);
  assert.equal(dom.activeElement, search);
  assert.equal(dom.browser.location.search, '');
  controller.destroy();
  assert.equal(dom.root.classList.contains('is-enhanced'), false);
  assert.equal(dom.$('[data-school-record][hidden]').length, 0);
  assert.equal(dom.$('[data-school-list-item][hidden]').length, 0);
});

test('category deep links stay local, wrong-category hashes remain safe, and modifier clicks retain native anchors', () => {
  const dom = isolatedDOM(render(fixtures, { category: 'international' }), 'https://sgeda.org.cn/international-school/schools/#school-international-one');
  const controller = initSchoolDatabase(dom.root, dom.browser);
  assert.equal(controller.getState().selectedId, 'international-one');
  const link = dom.element('[data-school-select="international-one"]');
  const modified = link.fire('click', { ctrlKey: true });
  assert.equal(modified.defaultPrevented, false);
  assert.equal(dom.browser.history.length, 1);
  dom.browser.navigateHash('#school-primary-one');
  assert.equal(controller.getState().selectedId, 'international-one');
  assert.match(controller.getState().notice, /未找到/);
  assert.equal(dom.browser.location.pathname, '/international-school/schools/');
  const empty = isolatedDOM(render([], { category: 'primary' }));
  const emptyController = initSchoolDatabase(empty.root, empty.browser);
  assert.equal(emptyController.getState().selectedId, null);
  assert.equal(empty.element('[data-school-empty]').hidden, false);
});

test('responsive stylesheet never hides records by default and uses bounded readable mobile columns', () => {
  const css = fs.readFileSync(path.join(root, 'assets/school-database.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'assets/school-database.js'), 'utf8');
  assert.doesNotMatch(css, /\.sdb-record\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /minmax\(0, 1fr\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|innerHTML\s*=/);
});

test('pure render is deterministic and import does not generate site HTML', () => {
  assert.equal(render(), render());
  assert.equal(render(fixtures, { category: 'primary' }), render(fixtures, { category: 'primary' }));
  const script = fs.readFileSync(path.join(root, 'scripts/build-school-database.mjs'), 'utf8');
  assert.match(script, /export async function buildSchoolDatabase/);
  assert.match(script, /import\.meta\.url === pathToFileURL/);
});

test('generator writes only its eight target pages, preserves shared brand/footer, and second build changes nothing', async context => {
  if (!fs.existsSync(path.join(root, 'scripts/school-catalog.mjs'))) return context.skip('catalog model not yet delivered; pure fixture tests remain runnable');
  const { CATEGORIES } = await import('../scripts/school-catalog.mjs');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-school-ui-fixture-'));
  try {
    const minimums = { primary: 179, secondary: 146, international: 1, private: 1, jc: 16, poly: 5, university: 7 };
    const records = CATEGORIES.flatMap(category => Array.from({ length: minimums[category.id] }, (_, index) => fixtureRecord(category.id, `fixture-${index + 1}`)));
    const policy = { version: 1, categories: CATEGORIES, retainedDetails: [], redirects: [] };
    fs.mkdirSync(path.join(temporaryRoot, 'content/schools'), { recursive: true });
    // Explicit synthetic fixture files, outside the repository and never actual school facts.
    fs.writeFileSync(path.join(temporaryRoot, 'content/schools/database.json'), JSON.stringify(records));
    fs.writeFileSync(path.join(temporaryRoot, 'content/schools/database-policy.json'), JSON.stringify(policy));
    const homepage = '<!doctype html><html><body><header class="site-header"><a class="brand active" href="/"><img src="/assets/seda-wordmark.svg" alt="SEDA 新加坡择校网"></a></header><footer class="site-footer"><a href="/contact/">联系 SEDA</a><span data-stat-fixture="original">原统计保留</span></footer></body></html>';
    fs.writeFileSync(path.join(temporaryRoot, 'index.html'), homepage);
    fs.writeFileSync(path.join(temporaryRoot, 'untouched.txt'), 'unchanged');
    const first = await buildSchoolDatabase(temporaryRoot);
    assert.equal(first.records, records.length);
    assert.equal(first.pages, 8);
    assert.equal(first.changed, 8);
    assert.deepEqual(first.categories, minimums);
    for (const page of first.routes) {
      const $ = load(fs.readFileSync(path.join(temporaryRoot, page.route, 'index.html'), 'utf8'));
      assert.equal($('header.site-header img').attr('src'), '/assets/seda-wordmark.svg');
      assert.equal($('footer.site-footer [data-stat-fixture]').text(), '原统计保留');
      assert.equal($('header.site-header a.active').length, 0);
      assert.equal($('[data-school-record]').length, page.count);
      assert.match($.html(), /SEDA_SCHOOL_DATABASE/);
    }
    const files = first.routes.map(page => path.join(temporaryRoot, page.route, 'index.html'));
    const times = files.map(file => fs.statSync(file).mtimeMs);
    const second = await buildSchoolDatabase(temporaryRoot);
    assert.equal(second.changed, 0);
    assert.deepEqual(files.map(file => fs.statSync(file).mtimeMs), times);
    assert.equal(fs.readFileSync(path.join(temporaryRoot, 'index.html'), 'utf8'), homepage);
    assert.equal(fs.readFileSync(path.join(temporaryRoot, 'untouched.txt'), 'utf8'), 'unchanged');
    assert.equal(fs.existsSync(path.join(temporaryRoot, 'robots.txt')), false);
    assert.equal(fs.existsSync(path.join(temporaryRoot, 'assets')), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('skip-to-content hash keeps the selected school and local filters without a false missing-school notice', () => {
  const dom = isolatedDOM(render());
  const app = initSchoolDatabase(dom.root, dom.browser);
  dom.element('#school-search').value = '测试大学';
  dom.element('#school-search').fire('input');
  const before = app.getState();
  assert.equal(before.selectedId, 'university-one');
  dom.browser.navigateHash('#school-database-main');
  assert.equal(schoolIdFromHash('#school-database-main'), null);
  const after = app.getState();
  assert.equal(after.selectedId, before.selectedId);
  assert.equal(after.query, before.query);
  assert.deepEqual(after.resultIds, before.resultIds);
  assert.equal(after.notice, '');
  assert.equal(dom.element('[data-school-record="university-one"]').hidden, false);
  const initial = transitionSchoolState(fixtures, {}, { type: 'init', hash: '#school-database-main' });
  assert.equal(initial.selectedId, fixtures[0].id);
  assert.equal(initial.notice, '');
  assert.match(transitionSchoolState(fixtures, before, { type: 'hash', hash: '#school-unknown-school' }).notice, /未找到链接对应的学校/);
});
