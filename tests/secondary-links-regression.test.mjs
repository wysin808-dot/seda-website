import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { readSecondarySchools, prerenderSecondarySchools } from '../scripts/prerender-secondary-schools.mjs';
import { addStaticSchoolList, STATIC_SCHOOL_LIST_STYLE } from '../scripts/add-static-school-list.mjs';
import { loadCatalog, loadCatalogPolicy } from '../scripts/school-catalog.mjs';

const root = path.resolve(import.meta.dirname, '..');
// Freeze the old 146-card interface as a legacy import/link-repair fixture.
// Production now uses the catalog; these tests must not demand restoration of
// COP cards, inline data scripts or 146 individual indexable articles.
const html = fs.readFileSync(path.join(root, 'tests/fixtures/secondary-schools-before-database.html'), 'utf8');
const $ = load(html);
const arrayRe = /const schools = \[([\s\S]*?)\n\s*\];/;
const schools = new Function(`return [${html.match(arrayRe)[1]}];`)();
const byName = new Map(schools.map(s => [s.name, s]));
const legacyHeadings = new Map(JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/secondary-school-identity.json'), 'utf8')).map(item => [item.link,item.h1]));
const escapeText = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// 已有页末21所链接及其本地详情H1确认的修复目标；不依赖外部审计目录。
const correctedTargets = {
  'East Spring Secondary School': 'east-spring',
  'Junyuan Secondary School': 'junyuan',
  'Meridian Secondary School': 'meridian',
  'Northland Secondary School': 'northland',
  'Orchid Park Secondary School': 'orchid-park',
  'Pei Hwa Secondary School': 'pei-hwa',
  'Queenstown Secondary School': 'queenstown',
  'Regent Secondary School': 'regent',
  'Seng Kang Secondary School': 'seng-kang',
  'Serangoon Secondary School': 'serangoon',
  'Spectra Secondary School': 'spectra',
  'Tampines Secondary School': 'tampines',
  'Temasek Junior College': 'temasek-junior-college',
  'Unity Secondary School': 'unity',
  'Westwood Secondary School': 'westwood',
  'Whitley Secondary School': 'whitley',
  'Woodgrove Secondary School': 'woodgrove',
  'Woodlands Secondary School': 'woodlands',
  'Yuhua Secondary School': 'yuhua',
  'Yuying Secondary School': 'yuying',
  'Zhenghua Secondary School': 'zhenghua',
};

function cardRecords(document) {
  return document('.school-card').toArray().map(el => {
    const card = document(el);
    assert.equal(card.find('h3 a').length, 1, 'each card has one school-name anchor');
    const a = card.find('h3 a');
    const href = a.attr('href');
    assert.match(href, /^\/secondary-schools\/[a-z0-9-]+\/$/);
    const onclick = card.attr('onclick');
    assert.equal(onclick, `location.href='${href}'`, a.text());
    const location = { href: '' };
    vm.runInNewContext(onclick, { location }, { timeout: 1000 });
    assert.equal(location.href, href, a.text());
    return { name: a.text(), cn: card.find('h3 small').text(), href };
  });
}

function expectedRecords(list) {
  return list.map(s => ({ name: s.name, cn: s.cn, href: s.link }));
}

function sorted(list) {
  return list.slice().sort((a, b) => (a.cop ?? Infinity) - (b.cop ?? Infinity));
}

function assertDetailEntity(s) {
  const detailFile = path.join(root, s.link.slice(1), 'index.html');
  assert.ok(fs.existsSync(detailFile), `${s.name}: local detail exists`);
  const detail = load(fs.readFileSync(detailFile, 'utf8'));
  assert.equal(detail('h1').length, 1, s.name);
  const cn = s.name === 'NUS High School of Math and Science' ? '新加坡国立大学附属数理中学' : s.cn;
  const en = s.name === 'NUS High School of Math and Science' ? 'NUS High School of Mathematics and Science' : s.name;
  if (fs.readFileSync(detailFile, 'utf8').includes('<!-- SEDA_SCHOOL_REDIRECT -->')) {
    const record = loadCatalog(root).find(record => record.legacyUrls.includes(s.link));
    assert.ok(record, `${s.name}: migrated record exists`);
    const redirect = loadCatalogPolicy(root).redirects.find(redirect => redirect.from === s.link);
    assert.ok(redirect, `${s.name}: exact redirect exists`);
    assert.equal(record.nameZh, cn, `${s.name}: Chinese identity preserved`);
    assert.equal(record.nameEn, en, `${s.name}: English identity preserved`);
    const target = new URL(redirect.to, 'https://sgeda.org.cn');
    const page = load(fs.readFileSync(path.join(root, target.pathname, 'index.html'), 'utf8'));
    assert.equal(page('link[rel="canonical"]').attr('href'), target.origin + target.pathname);
    if (target.hash) assert.equal(page('[id]').toArray().filter(el => page(el).attr('id') === target.hash.slice(1)).length, 1, `${s.name}: exact record target exists`);
    assert.match(detail('meta[name="robots"]').attr('content'), /noindex/);
    return;
  }
  // 本站原有数理中学使用中文全称及 Mathematics 别名，不修改详情或校名事实。
  assert.ok(detail('h1').text().includes(cn), `${s.name}: H1 matches school entity`);
  assert.ok(detail('main').text().includes(en), `${s.name}: English entity matches`);
  assert.equal(detail('link[rel="canonical"]').attr('href'), `https://sgeda.org.cn${s.link}`, s.name);
  detail('script[type="application/ld+json"]').each((_, el) => assert.doesNotThrow(() => JSON.parse(detail(el).text()), s.name));
}

// 只执行学校数据与筛选脚本；不执行分析代码、不联网、不使用浏览器。
function runtimePage() {
  const elements = new Map();
  for (const id of ['schoolGrid', 'noResults', 'resultsCount', 'resultsCountInline', 'searchInput', 'areaFilter', 'programFilter', 'copFilter', 'typeFilter', 'ipCount', 'sapCount', 'autoCount']) {
    elements.set(id, { value: '', innerHTML: '', textContent: '', style: {}, appendChild() {}, addEventListener() {} });
  }
  const document = { getElementById: id => elements.get(id), createElement: () => ({}) };
  const window = {};
  const script = $('script').toArray().map(el => $(el).text()).find(text => text.includes('const schools = ['));
  vm.runInNewContext(script, { document, window }, { timeout: 1000 });
  return {
    records: () => cardRecords(load(elements.get('schoolGrid').innerHTML)),
    cards: () => load(elements.get('schoolGrid').innerHTML),
    filter(values) {
      for (const id of ['searchInput', 'areaFilter', 'programFilter', 'copFilter', 'typeFilter']) elements.get(id).value = values[id] ?? '';
      window._applyFilters();
      return this.records();
    },
    elements,
  };
}

function withSchoolData(list) {
  return html.replace(arrayRe, `const schools = [\n${list.map(s => JSON.stringify(s)).join(',\n')}\n    ];`);
}

const outerCards = document => document('.school-card').toArray().map(el => document.html(el));
const hash = text => createHash('sha256').update(text).digest('hex');

const managedBlockRe = /<!-- SEDA_ALL_SCHOOLS_START -->[\s\S]*?<!-- SEDA_ALL_SCHOOLS_END -->\n?/;
const withoutManagedBlock = source => source.replace(managedBlockRe, '');
const supplementLinks = document => document('.all-schools a').toArray().map(el => document(el).attr('href'));
const assertNoTrailingWhitespace = source => assert.doesNotMatch(source, /[\t ]+$/m, 'no trailing whitespace');

function assertStyles(document) {
  const generator = 'add-static-school-list';
  // 来自修复前 HEAD 的逐块基线；仅规范化空白行，CSS规则、顺序和其它空格严格保留。
  // 页内原有第198行纯空格清除后，不应被误判为修改学校卡片样式。
  const original = document('style').filter((_, el) => document(el).attr('data-seda-generator') !== generator);
  assert.deepEqual(original.toArray().map(el => hash(document(el).html().replace(/^[\t ]+$/gm, ''))), [
    'fe6cf9a91a55c8a173a1bf5b2fbce1b324bc13d144c3db309146fece174f24c7',
  ], 'original school-page style blocks unchanged');
  const generated = document(`style[data-seda-generator="${generator}"]`);
  assert.equal(generated.length, 1, 'one traceable generated list stylesheet');
  assert.equal(generated.closest('.all-schools').length, 1, 'generated style belongs to list');
  assert.equal(generated.html(), STATIC_SCHOOL_LIST_STYLE, 'generated CSS agrees exactly with builder source');
  assert.equal(hash(STATIC_SCHOOL_LIST_STYLE), 'a85bd73cde0bd5ba8fdf11db87db95326dcc4d3058ba7ff9aebf991ad98a8023', 'original shared-list CSS unchanged');
}

// 仅向临时目录写 hub 和详情副本；测试不运行仓库全量构建器。
function secondaryFixture(t, source = html) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-secondary-list-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const dir = path.join(fixtureRoot, 'secondary-schools');
  fs.mkdirSync(dir);
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, source);
  for (const s of schools) {
    const slug = s.link.split('/')[2];
    fs.mkdirSync(path.join(dir, slug));
    // The fixture isolates the retired list builder from migrated production
    // fallback pages, which it must never enumerate as active school details.
    fs.writeFileSync(path.join(dir, slug, 'index.html'), `<h1>${escapeText(legacyHeadings.get(s.link))}</h1>`);
  }
  return {
    root: fixtureRoot, dir, file,
    read: () => fs.readFileSync(file, 'utf8'),
    run: (options = {}) => addStaticSchoolList(fixtureRoot, { targetDirs: ['secondary-schools'], ...options }),
  };
}

test('secondary links: source contains 146 schools and 146 unique detail URLs', () => {
  assert.equal(schools.length, 146);
  assert.equal(new Set(schools.map(s => s.name)).size, 146);
  assert.equal(new Set(schools.map(s => s.link)).size, 146);
  assert.deepEqual(readSecondarySchools(html), schools);
});

test('secondary links: all static names, hrefs, onclicks and detail entities agree', () => {
  const records = cardRecords($);
  assert.equal(records.length, 146);
  assert.equal(new Set(records.map(r => r.href)).size, 146);
  assert.deepEqual(records, expectedRecords(sorted(schools)));
  for (const s of schools) assertDetailEntity(s);
});

test('secondary links: the 21 confirmed corrections use their own existing detail URLs', () => {
  assert.equal(Object.keys(correctedTargets).length, 21);
  for (const [name, slug] of Object.entries(correctedTargets)) {
    const s = byName.get(name);
    const expected = `/secondary-schools/${slug}/`;
    assert.equal(s.link, expected, name);
    const footerLink = $('.all-schools a').toArray().find(el => $(el).attr('href') === expected);
    assert.ok(footerLink, `${name}: existing supplementary link retained`);
    assert.ok($(footerLink).text().includes(name), name);
    assertDetailEntity(s);
  }
});

test('secondary links: runtime initial rendering matches all 146 static cards', () => {
  const runtime = runtimePage();
  assert.deepEqual(runtime.records(), cardRecords($));
  assert.deepEqual(outerCards(runtime.cards()), outerCards($));
});

test('secondary links: search and filter re-rendering preserve correct click targets', () => {
  const runtime = runtimePage();
  for (const name of Object.keys(correctedTargets)) {
    const s = byName.get(name);
    for (const query of [s.name, s.cn]) {
      const result = runtime.filter({ searchInput: query });
      assert.deepEqual(result, expectedRecords(sorted(schools.filter(x => x.name.toLowerCase().includes(query.toLowerCase()) || x.cn.includes(query)))));
      assert.ok(result.some(r => r.name === name && r.href === s.link), name);
    }
  }
  assert.deepEqual(runtime.filter({ areaFilter: 'Woodlands' }), expectedRecords(sorted(schools.filter(s => s.area === 'Woodlands'))));
  assert.deepEqual(runtime.filter({ programFilter: 'IP' }), expectedRecords(sorted(schools.filter(s => s.programs.includes('IP')))));
  assert.deepEqual(runtime.filter({ copFilter: 'null' }), expectedRecords(sorted(schools.filter(s => s.cop === null))));
  assert.deepEqual(runtime.filter({ copFilter: '19-22', typeFilter: 'Government' }), expectedRecords(sorted(schools.filter(s => s.cop !== null && s.cop >= 19 && s.cop <= 22 && s.type === 'Government'))));
  assert.deepEqual(runtime.filter({ searchInput: '__no_school_matches__' }), []);
  assert.equal(runtime.elements.get('noResults').style.display, 'block');
  assert.deepEqual(runtime.filter({}), cardRecords($));
});

test('secondary links: in-memory prerender cannot restore stale hrefs or onclicks', () => {
  const output = prerenderSecondarySchools(html);
  const rendered = load(output);
  assert.deepEqual(cardRecords(rendered), cardRecords($));
  assert.deepEqual(outerCards(rendered), outerCards($));
  assert.equal(prerenderSecondarySchools(output), output, 'prerender is idempotent');
  const withoutGrid = document => document.replace(/(<div class="school-grid" id="schoolGrid">)[\s\S]*?(<\/div>\s*<div class="no-results")/, '$1$2');
  assert.equal(withoutGrid(output), withoutGrid(html), 'prerender only replaces schoolGrid');
});

test('secondary links: prerender rejects duplicate, missing and malformed target sources', () => {
  const duplicate = schools.map(s => ({ ...s }));
  duplicate[1].link = duplicate[0].link;
  assert.throws(() => prerenderSecondarySchools(withSchoolData(duplicate)), /duplicate school target/);
  const invalid = schools.map(s => ({ ...s }));
  invalid[0].link = '';
  assert.throws(() => prerenderSecondarySchools(withSchoolData(invalid)), /invalid school link/);
  invalid[0].link = '/primary-schools/admiralty/';
  assert.throws(() => prerenderSecondarySchools(withSchoolData(invalid)), /invalid school link/);
  assert.throws(() => prerenderSecondarySchools(withSchoolData(schools.slice(1))), /unexpected school count/);
});

test('secondary links: non-link school facts, existing styles and JSON-LD remain intact', () => {
  // 学校事实仍使用原始基线；原样式与可追溯生成样式分别验证，不硬编码所有style的拼接哈希。
  assert.equal(hash(JSON.stringify(schools.map(({ link, ...rest }) => rest))), 'a72613164572cbd32309a475cb06d1d6c00ebcc8b448759482b1c2d60da20461');
  assertStyles($);
  $('script[type="application/ld+json"]').each((_, el) => assert.doesNotThrow(() => JSON.parse($(el).text())));
  assert.equal($('#schoolGrid').length, 1);
  assert.equal($('main').length, 1);
});

test('secondary build: original, generated and unknown style mutations are not silently allowed', () => {
  assert.throws(() => assertStyles(load(html.replace('.stats-bar{display:flex', '.stats-bar{display:grid'))), /original school-page style/);
  assert.throws(() => assertStyles(load(html.replace('.all-schools summary{cursor:pointer', '.all-schools summary{cursor:default'))), /generated CSS agrees/);
  assert.throws(() => assertStyles(load(html.replace('</head>', '<style>.unexpected{display:none}</style></head>'))), /original school-page style/);
  assert.throws(() => assertStyles(load(html.replace('</head>', `<style data-seda-generator="add-static-school-list">${STATIC_SCHOOL_LIST_STYLE}</style></head>`))), /one traceable generated/);
});

test('secondary build: legacy 21-link index survives full card coverage and repeated list/prerender updates', t => {
  const legacy = html.replace(' data-seda-generator="add-static-school-list"', '')
    .replace('补充学校索引（21 所，共 146 所，', '其余 21 所（共 146 所，');
  const fixture = secondaryFixture(t, legacy);
  assert.deepEqual(fixture.run({ checkOnly: true }), { updated: 1 });
  assert.equal(fixture.read(), legacy, 'checkOnly never writes');
  assert.deepEqual(fixture.run(), { updated: 1 });
  const output = fixture.read();
  const built = load(output);
  assert.equal(output, html, 'legacy index migrates to checked-in stable output');
  assert.equal(withoutManagedBlock(output), withoutManagedBlock(legacy), 'only managed list changes');
  assert.deepEqual(supplementLinks(built), supplementLinks($));
  assert.equal(supplementLinks(built).length, 21);
  assert.equal(new Set(supplementLinks(built)).size, 21);
  assert.deepEqual(cardRecords(built), cardRecords($));
  assert.deepEqual(readSecondarySchools(output), schools);
  assertStyles(built);
  assertNoTrailingWhitespace(output);
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(fixture.file, prerenderSecondarySchools(fixture.read()));
    assert.deepEqual(fixture.run(), { updated: 0 });
    assert.equal(fixture.read(), output, 'prerender + list generation byte-stable');
    assertNoTrailingWhitespace(fixture.read());
  }
});

test('secondary build: missing details merge with retained links, deduplicate and prune stale URLs', t => {
  const polluted = html.replace('    </ul>\n  </details>', `      <li><a href="/secondary-schools/east-spring/">duplicate stale label</a></li>
      <li><a href="/secondary-schools/deleted-fixture/">deleted school</a></li>
      <li><a href="https://example.invalid/">external school</a></li>
    </ul>\n  </details>`);
  const fixture = secondaryFixture(t, polluted);
  const newDir = path.join(fixture.dir, 'new-fixture-school');
  fs.mkdirSync(newDir);
  fs.writeFileSync(path.join(newDir, 'index.html'), '<h1>新增测试中学 New Discovery Secondary School 完全指南</h1>');
  assert.deepEqual(fixture.run(), { updated: 1 });
  const output = fixture.read();
  const built = load(output);
  const links = supplementLinks(built);
  assert.equal(links.length, 22);
  assert.equal(new Set(links).size, 22);
  for (const link of supplementLinks($)) assert.ok(links.includes(link), link);
  assert.ok(links.includes('/secondary-schools/new-fixture-school/'));
  assert.ok(!links.includes('/secondary-schools/deleted-fixture/'));
  assert.ok(!links.includes('https://example.invalid/'));
  assert.equal(built('.all-schools a[href="/secondary-schools/new-fixture-school/"]').text(), '新增测试中学 New Discovery Secondary School');
  assert.match(built('#all-schools-title').text(), /补充学校索引（22 所，共 147 所/);
  assert.equal(withoutManagedBlock(output), withoutManagedBlock(polluted));
  assert.deepEqual(cardRecords(built), cardRecords($));
  assert.deepEqual(readSecondarySchools(output), schools);
  assertStyles(built);
  assertNoTrailingWhitespace(output);
  assert.deepEqual(fixture.run(), { updated: 0 });
  assert.equal(fixture.read(), output);
  // 该补链后来也有主区入口时仍保留独立索引，并按当前详情H1刷新名称。
  const nowLinked = output.replace('</main>', '<a href="/secondary-schools/new-fixture-school/">new primary entry</a>\n</main>');
  fs.writeFileSync(fixture.file, nowLinked);
  fs.writeFileSync(path.join(newDir, 'index.html'), '<h1>更新测试中学 Renamed Discovery Secondary School 中文指南</h1>');
  assert.deepEqual(fixture.run(), { updated: 1 });
  const renamed = fixture.read();
  assert.equal(load(renamed)('.all-schools a[href="/secondary-schools/new-fixture-school/"]').text(), '更新测试中学 Renamed Discovery Secondary School');
  assert.equal(supplementLinks(load(renamed)).length, 22);
  assert.deepEqual(fixture.run(), { updated: 0 });
  assert.equal(fixture.read(), renamed);
  assertNoTrailingWhitespace(renamed);
});

test('secondary build: targeted updates cannot read or write another hub', t => {
  const fixture = secondaryFixture(t, html.replace(' data-seda-generator="add-static-school-list"', ''));
  const otherDir = path.join(fixture.root, 'primary-schools');
  fs.mkdirSync(otherDir);
  const sentinel = '<main><h1>untouched other hub</h1></main>\n';
  fs.writeFileSync(path.join(otherDir, 'index.html'), sentinel);
  for (let i = 0; i < 5; i++) {
    fs.mkdirSync(path.join(otherDir, `school-${i}`));
    fs.writeFileSync(path.join(otherDir, `school-${i}`, 'index.html'), `<h1>other ${i}</h1>`);
  }
  assert.deepEqual(fixture.run(), { updated: 1 });
  assert.equal(fs.readFileSync(path.join(otherDir, 'index.html'), 'utf8'), sentinel);
  assert.equal(fixture.read(), html);
  assert.deepEqual(fixture.run(), { updated: 0 });
  // 全量入口在临时目录验证：非中学仍只补未链接详情，不保留重复索引。
  assert.deepEqual(addStaticSchoolList(fixture.root), { updated: 1 });
  const otherFile = path.join(otherDir, 'index.html');
  const otherBuilt = fs.readFileSync(otherFile, 'utf8');
  assert.equal(load(otherBuilt)('.all-schools a').length, 5);
  assert.equal(load(otherBuilt)('style[data-seda-generator]').length, 0, 'other hubs markup unchanged');
  const mainLinks = Array.from({ length: 5 }, (_, i) => `<a href='/primary-schools/school-${i}/'>other ${i}</a>`).join('\n');
  fs.writeFileSync(otherFile, otherBuilt.replace('</main>', `${mainLinks}\n</main>`));
  addStaticSchoolList(fixture.root);
  assert.equal(load(fs.readFileSync(otherFile, 'utf8'))('.all-schools').length, 0);
  assert.equal(fixture.read(), html);
});

test('secondary build: first missing-link index insertion is immediately byte-stable', t => {
  const initial = withoutManagedBlock(html);
  const fixture = secondaryFixture(t, initial);
  const newDir = path.join(fixture.dir, 'first-fixture-school');
  fs.mkdirSync(newDir);
  fs.writeFileSync(path.join(newDir, 'index.html'), '<h1>首次发现测试中学 First Discovery Secondary School 完全攻略</h1>');
  assert.deepEqual(fixture.run({ checkOnly: true }), { updated: 1 });
  assert.equal(fixture.read(), initial);
  assert.deepEqual(fixture.run(), { updated: 1 });
  const output = fixture.read();
  const built = load(output);
  assert.deepEqual(supplementLinks(built), ['/secondary-schools/first-fixture-school/']);
  assert.equal(built('#all-schools-title').text(), '补充学校索引（1 所，共 147 所，按拼音排序，可展开）');
  assert.equal(withoutManagedBlock(output), initial);
  assert.deepEqual(cardRecords(built), cardRecords($));
  assert.deepEqual(readSecondarySchools(output), schools);
  assertStyles(built);
  assertNoTrailingWhitespace(output);
  assert.deepEqual(fixture.run(), { updated: 0 });
  assert.equal(fixture.read(), output);
  assert.deepEqual(fixture.run({ checkOnly: true }), { updated: 0 });
});

test('secondary build: absent index is a no-op; invalid empty index removal leaves no whitespace', t => {
  const withoutList = withoutManagedBlock(html);
  const fixture = secondaryFixture(t, withoutList);
  assert.deepEqual(fixture.run(), { updated: 0 });
  assert.equal(fixture.read(), withoutList, '146 cards already provide complete crawlable coverage');
  const invalidBlock = `    <!-- SEDA_ALL_SCHOOLS_START -->
<section class="all-schools"><a href="/secondary-schools/deleted-fixture/">stale</a></section>
<!-- SEDA_ALL_SCHOOLS_END -->\n`;
  const stale = withoutList.replace('</main>', `${invalidBlock}</main>`);
  fs.writeFileSync(fixture.file, stale);
  assert.deepEqual(fixture.run({ checkOnly: true }), { updated: 1 });
  assert.equal(fixture.read(), stale);
  assert.deepEqual(fixture.run(), { updated: 1 });
  assert.equal(fixture.read(), withoutList);
  assertNoTrailingWhitespace(fixture.read());
  assert.deepEqual(fixture.run(), { updated: 0 });
});
