import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const routes = ['aeis/age-requirements', 'aeis/english', 'o-level', 'wace-nus-ntu', 'guides/cost'];
const page = route => load(read(route + '/index.html'));
const sources = JSON.parse(read('content/sources.json'));

for (const route of routes) {
  test(route + ': reviewed sources, headings and internal destinations exist', () => {
    const $ = page(route);
    const entry = sources['https://sgeda.org.cn/' + route + '/'];
    assert.equal(entry.lastVerified, '2026-11-26');
    assert.ok(entry.sources.length >= 2);
    assert.equal($('.seda-sources').length, 0, 'no unified visible sources module');
    const entities = $('script[type="application/ld+json"]').toArray()
      .flatMap(script => { const data = JSON.parse($(script).text()); return data['@graph'] || [data]; })
      .filter(node => ['Article', 'WebPage', 'CollectionPage'].includes(node['@type']));
    assert.ok(entities.length > 0, 'sources belong to a real page entity');
    for (const entity of entities) {
      assert.deepEqual(entity.citation, entry.sources.map(source => source.url));
      assert.equal(entity.dateModified, entry.lastVerified);
    }
    $('.content-main a[href^="/"], #official-update a[href^="/"], #compare a[href^="/"]').each((_, a) => {
      const href = $(a).attr('href');
      const url = new URL(href, 'https://sgeda.org.cn');
      assert.ok(fs.existsSync(path.join(root, url.pathname, 'index.html')), href);
    });
    assert.ok($('table').length >= 2, 'scannable comparisons');
    if (route !== 'o-level') {
      assert.equal($('link[href="/assets/reviewed-content.css?v=1"]').length, 1);
      assert.ok(fs.existsSync(path.join(root, 'assets/reviewed-content.css')));
      $('.data-table').each((_, table) => {
        if ($(table).find('thead th').length <= 3) assert.ok($(table).hasClass('focus-table'), 'short tables fit narrow screens');
      });
    }
    const ids = $('[id]').map((_, el) => $(el).attr('id')).get();
    assert.equal(new Set(ids).size, ids.length, 'unique anchor IDs');
  });
}

test('AEIS distinguishes admission year, CEQ types and secondary English', () => {
  const age = page('aeis/age-requirements')('.content-main').text();
  assert.match(age, /考试年份不等于入学年份/);
  assert.match(age, /2019 年 6 月 15 日/);
  assert.match(age, /2027 年/);
  assert.doesNotMatch(age, /考试当年.*1月1日|竞争相对较低|根据我们多年/);
  const agePage = page('aeis/age-requirements');
  assert.equal(agePage('.content-layout > .content-main').length, 1, 'article must be a shrinkable grid child');
  assert.doesNotMatch(agePage('body').text(), /6123 4567|SEDA-SG/);
  for (const route of ['aeis/age-requirements', 'aeis/english']) {
    const $ = page(route);
    const rows = $('tr').map((_, el) => $(el).text()).get().join('\n');
    for (const [grade, exam, score] of [['P2','A2 Key for Schools','100'],['P3','A2 Key for Schools','120'],['P4','A2 Key for Schools','130'],['P5','B1 Preliminary for Schools','140']]) {
      assert.ok(rows.split('\n').some(row => row.includes(grade) && row.includes(exam) && row.includes(score)), grade);
    }
  }
  const english = page('aeis/english')('.content-main').text();
  assert.match(english, /2025 年 7 月/);
  assert.match(english, /不能自动套用到 2027 报名/);
  assert.match(english, /200–300 词/);
  assert.match(english, /250–350 词/);
  assert.match(english, /300–400 词/);
  assert.doesNotMatch(english, /大多数孩子|两科都设门槛|每年按年级调整/);
});

test('WACE official eligibility replaces invented programme cutoffs and cases', () => {
  const html = read('wace-nus-ntu/index.html');
  const $ = load(html);
  const firstRow = $('.content-main tbody tr').first().find('td').map((_,el) => $(el).text()).get();
  assert.deepEqual(firstRow, ['最低 ATAR', '90', '95']);
  assert.match($('.content-main').text(), /申请条件，不是各专业录取线/);
  assert.match($('.content-main').text(), /不凭预测成绩录取/);
  assert.match($('.content-main').text(), /ESL\/EAL/);
  assert.doesNotMatch(html, /Brentvale|BCI 学生案例|NUS 各学院 ATAR 要求|NTU 各学院 ATAR 要求/);
  assert.doesNotMatch(read('scripts/enhance-key-seo-pages.mjs'), /file: 'wace-nus-ntu\/index.html'/);
});

test('SEC keeps O-Level terms but separates examination and admission years', () => {
  const $ = page('o-level');
  assert.equal($('head > title').length, 1);
  assert.match($('head > title').text(), /O-Level.*2027 SEC/);
  assert.match($('#official-update').text(), /2027 JC：L1R5/);
  assert.match($('#official-update').text(), /2028 JC：L1R4/);
  assert.match($('#official-update').text(), /全部为 G3/);
  assert.doesNotMatch($('#compare').text(), /数理优势|本地认可度最高|性价比最高/);
});

test('cost illustration uses labelled assumptions and correct annual arithmetic', () => {
  const text = page('guides/cost')('.content-main').text();
  assert.match(text, /2026 年，非东盟国际学生/);
  assert.match(text, /不是住宿市场均价/);
  assert.match(text, /不含陪读家长/);
  assert.match(text, /并非实时汇率/);
  assert.ok(text.includes((1035 * 12 + 13 * 12 + 1200 * 12 + 600 * 12).toLocaleString('en-US')));
  assert.ok(text.includes((2190 * 12 + 20 * 12 + 1200 * 12 + 600 * 12).toLocaleString('en-US')));
  assert.match(text, /不能当成 2027 年承诺报价/);
});
