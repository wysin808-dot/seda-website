import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const root = fileURLToPath(new URL('../', import.meta.url));
const verified = '2026-11-26';
const marker = '<!-- SEDA_CUSTOM_PAGE -->';
const sourceConfig = JSON.parse(fs.readFileSync(path.join(root, 'content/sources.json'), 'utf8'));
const sources = [
  'https://www.moe.gov.sg/schoolfinder/schooldetail/catholic-junior-college',
  'https://www.moe.gov.sg/schoolfinder/schooldetail/st-andrews-junior-college',
  'https://www.cjc.moe.edu.sg/contact-us/',
  'https://www.standrewsjc.moe.edu.sg/about-us/contact-us/',
  'https://www.standrewsjc.moe.edu.sg/about-us/heritage/',
  'https://moehc.moe.edu.sg/school-history/school-histories/catholic-jc/',
  'https://moehc.moe.edu.sg/school-history/school-histories/st-andrew-jc/',
];
const pages = [
  { slug: 'catholic-jc', name: 'CJC', address: '129 Whitley Road', postcode: '297822', hero: '3', image: '/assets/sg-px-36882343.jpg' },
  { slug: 'st-andrews-jc', name: 'SAJC', address: '5 Sorby Adams Drive', postcode: '357691', hero: '2', image: '/assets/sg-px-32818048.jpg' },
].map(page => {
  const url = `/jc/${page.slug}/`;
  const html = fs.readFileSync(path.join(root, url, 'index.html'), 'utf8');
  return { ...page, url, html, $: load(html) };
});

// Exact affirmative claims from the broken pages. Negative corrections may still
// mention 2020, merger or closure: a blanket ban on those words would hide context.
const falseClaims = [
  '含前圣安德烈JC', '2020年并入圣安德烈JC', '2020年并入公教JC',
  '2020 年圣安德烈初级学院（SAJC）并入 CJC',
  '2020 年并入 SAJC 后', 'CJC 保留名称并吸纳 SAJC 的学生和师资',
  'SAJC 校区正式关闭', 'SAJC 于 2020 年 1 月正式关闭',
  '圣安德烈初级学院已于 2020 年关闭', '已吸纳原 SAJC 师生',
  '教职人员统一并入公教初级学院', '目前不再作为学校使用',
  '原 SAJC 旧址附近区域', '含原 SAJC', '1978–2020', '357701',
];
function rejectOldClaims(html) {
  const $ = load(html);
  const fields = [
    $('title').text(), $('main').text(),
    ...$('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').map((_, node) => $(node).attr('content') || '').get(),
    ...$('script[type="application/ld+json"]').map((_, node) => $(node).text()).get(),
  ].join('\n');
  for (const claim of falseClaims) assert.ok(!fields.includes(claim), `False merger assertion returned: ${claim}`);
  assert.ok(!/class="num">已关闭</.test(html), 'Closed-school statistic returned');
  assert.ok(!/class="label">并校年份</.test(html), 'Merger-year statistic returned');
}

for (const page of pages) {
  test(`jc-merger-regression/${page.slug}/html-current-status-and-no-false-merger`, () => {
    const { $, html, address, postcode } = page;
    rejectOldClaims(html);
    assert.equal($('html').attr('lang'), 'zh-CN');
    assert.equal($('title').length, 1);
    assert.equal($('h1').length, 1);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://sgeda.org.cn${page.url}`);
    assert.equal($('meta[property="og:url"]').attr('content'), `https://sgeda.org.cn${page.url}`);
    assert.match($('meta[name="description"]').attr('content'), /独立办学/);
    assert.match($('.hero-subtitle').text(), /独立办学/);
    assert.ok($('main').text().includes(address));
    assert.ok($('main').text().includes(postcode));
    assert.ok($('.sidebar').text().includes(address));
    assert.ok($('.sidebar').text().includes(postcode));
    assert.match($('.stats-bar').text(), /独立办学/);
  });

  test(`jc-merger-regression/${page.slug}/jsonld-official-citations-and-corrected-faq`, () => {
    const { $ } = page;
    const nodes = $('script[type="application/ld+json"]').map((_, node) => JSON.parse($(node).text())).get();
    const articles = nodes.filter(node => node['@type'] === 'Article');
    assert.equal(articles.length, 1);
    const article = articles[0];
    assert.equal(article.headline, $('h1').text());
    assert.equal(article.mainEntityOfPage, `https://sgeda.org.cn${page.url}`);
    assert.equal(article.dateModified, verified);
    assert.deepEqual(article.citation, sources);
    const faqs = nodes.filter(node => node['@type'] === 'FAQPage');
    assert.equal(faqs.length, 1);
    const visible = new Map($('.faq-section details').map((_, node) => ({
      name: $(node).find('summary').text(), answer: $(node).find('p').text(),
    })).get().map(item => [item.name, item.answer]));
    // Only the merger-related FAQ is changed on CJC; its unrelated legacy FAQ
    // entries remain out of this narrowly scoped audit.
    const corrected = page.name === 'CJC' ? faqs[0].mainEntity.slice(0, 1) : faqs[0].mainEntity;
    assert.equal(corrected.length, page.name === 'CJC' ? 1 : 4);
    for (const question of corrected) {
      assert.equal(question['@type'], 'Question');
      assert.equal(question.acceptedAnswer['@type'], 'Answer');
      assert.equal(question.acceptedAnswer.text, visible.get(question.name));
    }
  });

  test(`jc-merger-regression/${page.slug}/school-status-and-address-retained-without-unified-verification-date`, () => {
    const { $ } = page;
    const block = $('#official-verification');
    assert.equal(block.length, 1);
    assert.equal(block.find('h2').text(), '学校存续与校址');
    assert.equal(block.find('time').length, 0);
    assert.doesNotMatch($('main').text(), /核实日期|已于.*2026-11-26.*核实/);
    assert.match(block.text(), /分别独立办学/);
    assert.match(block.text(), /129 Whitley Road, Singapore 297822/);
    assert.match(block.text(), /5 Sorby Adams Drive, Singapore 357691/);
    const links = block.find('a').map((_, node) => $(node).attr('href')).get();
    assert.deepEqual(links, sources);
    for (const url of links) {
      const hostname = new URL(url).hostname;
      assert.ok(hostname === 'www.moe.gov.sg' || hostname.endsWith('.moe.edu.sg'));
    }
    const record = sourceConfig[`https://sgeda.org.cn${page.url}`];
    assert.equal(record.lastVerified, verified);
    assert.deepEqual(record.sources.map(source => source.url), links);
    assert.match(record.note, /不代表已复核本页其他分数、费用或升学数据/);
  });

  test(`jc-merger-regression/${page.slug}/existing-visual-shell-preserved`, () => {
    const { $ } = page;
    assert.equal($('.page-hero.school-hero').length, 1);
    assert.equal($('.school-hero').attr('data-hero'), page.hero);
    assert.ok($('.school-hero').attr('style').includes(page.image));
    assert.equal($('link[rel="stylesheet"]').attr('href'), '/seda-site.css?v=45');
    assert.equal($('.content-layout').length, 1);
    assert.equal($('.content-layout > .content-main').length, 1);
    assert.equal($('.content-layout > .sidebar').length, 1);
    assert.equal($('.stats-bar > .stat-item').length, 4);
    assert.equal($('.site-header').length, 1);
    assert.equal($('.site-footer').length, 1);
    assert.equal($('script[src="/seda-site.js?v=30"]').length, 1);
  });
}

test('jc-merger-regression/sajc/remove-closure-derived-replacement-score-table', () => {
  const sajc = pages.find(page => page.name === 'SAJC');
  const { $ } = sajc;
  assert.deepEqual($('.table-wrap thead th').map((_, node) => $(node).text()).get(), ['学校', '现行校址', 'MOE 课程代码']);
  assert.equal($('.table-wrap tbody tr').length, 2);
  assert.match($('.table-wrap').text(), /30A[\s\S]*30S/);
  assert.match($('.table-wrap').text(), /23A[\s\S]*23S/);
  assert.ok(!/L1R5\s*(?:约|参考区间)|\b(?:10–16|12–18|12–20|9–15|8–15)\b/.test($('main').text()));
  assert.ok(!$('main a[href="/jc/anderson-serangoon-jc/"],main a[href="/jc/nanyang-jc/"],main a[href="/jc/temasek-jc/"]').length);
});

test('jc-merger-regression/cjc/current-dsa-is-not-denied-by-legacy-admission-copy', () => {
  const { $ } = pages.find(page => page.name === 'CJC');
  const text = $('main').text();
  assert.ok(!text.includes('CJC 不设 DSA 通道'));
  assert.ok(!text.includes('所有外部学生均须通过 JAE'));
  assert.match(text, /2026 年 DSA 项目/);
  assert.match(text, /不能把 IGCSE 直接视为可参加 JAE 的等效资格/);
});

test('jc-merger-regression/negative-control-rejects-both-old-merger-directions-and-closure', () => {
  for (const claim of ['2020年并入圣安德烈JC', '2020年并入公教JC', 'SAJC 校区正式关闭', '目前不再作为学校使用']) {
    assert.throws(() => rejectOldClaims(`<html><head><title>${claim}</title></head><body><main>${claim}</main></body></html>`), /False merger assertion/);
  }
});

test('jc-merger-regression/build-source-routes-cannot-regenerate-these-custom-pages', () => {
  const schools = JSON.parse(fs.readFileSync(path.join(root, 'content/schools/seo-schools.json'), 'utf8'));
  const targets = new Set(pages.map(page => page.url));
  for (const school of schools) {
    if (targets.has(`/${school.basePath}/${school.slug}/`)) assert.equal(school.customContent, true, 'School generator must skip a custom JC page');
  }
  for (const page of pages) assert.ok(page.html.includes(marker), 'Existing article-write and draft-delete guards require the custom marker');
  // Both custom pages preserve their factual body and the same centrally maintained evidence.
  for (const page of pages) {
    const entry = sourceConfig[`https://sgeda.org.cn${page.url}`];
    assert.equal(entry.lastVerified, verified);
    assert.deepEqual(entry.sources.map(source => source.url), sources);
  }
});

test('jc-merger-regression/existing-build-write-and-draft-delete-guards-isolated-no-full-build', () => {
  // Extract ONLY the two existing guard functions. Never import or run the build
  // entrypoint: its top-level side effects would modify other agents\' pages.
  const build = fs.readFileSync(path.join(root, 'scripts/build-content.mjs'), 'utf8');
  const writeFn = build.match(/function writeArticle\(article\) \{[\s\S]*?\n\}\n\nfunction removeDraftArticlePage/);
  const removeFn = build.match(/function removeDraftArticlePage\(article\) \{[\s\S]*?\n\}\n\nfunction githubEditUrl/);
  assert.ok(writeFn && removeFn, 'Locate the real existing guard functions');
  const functions = writeFn[0].replace(/\n\nfunction removeDraftArticlePage$/, '') + '\n' + removeFn[0].replace(/\n\nfunction githubEditUrl$/, '');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-jc-merger-regression-'));
  try {
    const context = vm.createContext({ fs, path, root: temporaryRoot, articles: [], renderArticle: () => 'GENERATED-NEGATIVE-CONTROL' });
    vm.runInContext(functions, context);
    for (const page of pages) {
      const directory = path.join(temporaryRoot, page.url);
      const file = path.join(directory, 'index.html');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(file, page.html);
      const article = { url: page.url, meta: { slug: page.slug } };
      context.writeArticle(article);
      assert.equal(fs.readFileSync(file, 'utf8'), page.html, 'Published article must not overwrite custom HTML');
      context.removeDraftArticlePage(article);
      assert.equal(fs.readFileSync(file, 'utf8'), page.html, 'Draft cleanup must not delete custom HTML');
    }
    // Negative control proves both real functions executed, rather than a test
    // that silently does nothing regardless of the page protection marker.
    const url = '/jc/jc-merger-regression-negative-control/';
    const dir = path.join(temporaryRoot, url);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>unprotected</html>');
    const article = { url, meta: { slug: 'jc-merger-regression-negative-control' } };
    context.writeArticle(article);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), 'GENERATED-NEGATIVE-CONTROL');
    context.removeDraftArticlePage(article);
    assert.ok(!fs.existsSync(dir));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
