import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { parse } from 'parse5';
import { load } from 'cheerio';

// This test reads only the OSSD static page; it does not build or modify the site.
const html = fs.readFileSync(new URL('../ossd/index.html', import.meta.url), 'utf8');
const $ = load(html);
const sources = JSON.parse(fs.readFileSync(new URL('../content/sources.json', import.meta.url), 'utf8'));
const record = sources['https://sgeda.org.cn/ossd/'];
const normalize = text => text.replace(/\s+/g, '');
const schemas = $('script[type="application/ld+json"]').toArray()
  .map(el => JSON.parse($(el).text()));
const faqSchema = schemas.find(node => node['@type'] === 'FAQPage');
const grad = normalize($('#grad').text());
const faqGrad = normalize($('.ossd-faq details').filter((_, el) =>
  $(el).find('summary').text() === '毕业具体要满足哪些条件？').find('.a').text());
const officialUrl = 'https://www.ontario.ca/page/earning-your-high-school-diploma';

function requireText(text, fragments) {
  for (const fragment of fragments) assert.ok(text.includes(normalize(fragment)), fragment);
}

test('OSSD has valid HTML, parseable JSON-LD, and syntactically valid inline JavaScript', () => {
  const errors = [];
  parse(html, { onParseError: error => errors.push(error.code) });
  assert.deepEqual(errors, []);
  assert.equal($('main.ossd-page').length, 1);
  assert.equal($('h1').length, 1);
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://sgeda.org.cn/ossd/');
  assert.equal(schemas.filter(node => node['@type'] === 'FAQPage').length, 1);
  $('script:not([src]):not([type="application/ld+json"])').each((_, el) => {
    assert.doesNotThrow(() => new Script($(el).text()));
  });
  const ids = $('[id]').map((_, el) => $(el).attr('id')).get();
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  $('main a[href^="#"]').each((_, el) => {
    assert.equal($($(el).attr('href')).length, 1, $(el).attr('href'));
  });
});

test('graduation requirements distinguish both Grade 9 entry cohorts and sum to 30 credits', () => {
  for (const text of [grad, faqGrad]) {
    requireText(text, [
      '2023 及以前', '18 个必修 + 12 个选修',
      '2024 及以后', '17 个必修 + 13 个选修',
      '30 学分', '识字要求', '至少 40 小时社区服务'
    ]);
  }
  const blocks = $('#road details').filter((_, el) => /必修学分怎么构成/.test($(el).find('summary').text()));
  assert.equal(blocks.length, 2);
  blocks.each((i, el) => {
    const sum = $(el).find('.ossd-comp .c').toArray().reduce((total, cell) => total + Number($(cell).text()), 0);
    assert.equal(sum, i === 0 ? 18 : 17);
  });
  const modern = normalize(blocks.eq(1).text());
  requireText(modern, ['技术教育', '9 或 10 年级', 'STEM 相关', '组别学分']);
  assert.ok($('#grad .ossd-ring').eq(0).text().includes('2024'));
  assert.ok($('#grad .ossd-ring').eq(0).text().includes('17 必修'));
  assert.ok($('#grad .ossd-ring').eq(0).text().includes('13 选修'));
  requireText(normalize($('#grad .ossd-ring').eq(2).text()), ['满足识字要求', '通常通过 OSSLT', '其他合规途径向校长确认']);
});

test('online learning has its entry-year scope, included credits, and explicit opt-out procedure', () => {
  for (const text of [grad, faqGrad]) {
    requireText(text, [
      '2020–2021 学年及以后开始 Grade 9', '至少 2 个线上学习学分', '计入 30 学分',
      '2023–2024 学年及以后进入中学系统的成人学习者',
      'opt-out', '18 岁及以上', '16/17 岁', '已脱离父母或监护人管束',
      '家长或监护人代为申请', '并非自动豁免'
    ]);
  }
  requireText(grad, ['自行填写学校教育局的豁免表', '不是额外加 2 学分']);
});

test('financial literacy applies to Grade 9 starters in 2025–26 onward, effective 2026–27', () => {
  for (const text of [grad, faqGrad]) {
    requireText(text, [
      '2025–2026 学年及以后开始 Grade 9', 'Grade 10 Career Studies',
      '金融素养毕业要求', '2026–2027 学年实施', '至少取得 70%',
      '其他合规途径', '校长确认'
    ]);
  }
  requireText(grad, ['不要将此项一概套用于 2024 开始 Grade 9 的学生']);
  assert.doesNotMatch(html, /2024[^<。；]{0,40}(?:均须|必须|还须)满足金融素养/);
});

test('application cards and FAQs separate course qualification, domestic status, and language waivers', () => {
  const cards = normalize($('.ossd-sell-grid').text());
  requireText(cards, [
    'OSSD 不赋予加拿大公民或永久居民身份', '学费与名额类别另核',
    'ENG4U 学分不等于自动免雅思/托福', '目标大学当年条件审核'
  ]);
  requireText(normalize($('.ossd-dest.best').text()), ['不自动获得本地生学费或名额待遇']);
  requireText(normalize($('.ossd-faq').text()), [
    '不自动带来本地生学费或名额待遇', '本页不承诺任何具体大学的豁免资格',
    '课程成绩包含平时与期末评估', '指定先修课', '完整成绩单', '最终成绩达标',
    '英语语言成绩', '补充材料或面试'
  ]);
  requireText(normalize($('#road').text()), ['课程成绩是重要依据，非唯一条件', '不是所有学生统一课表']);
});

test('old absolute claims cannot return through metadata, marquee, SVG hints, or comparison data', () => {
  for (const stale of [
    '只要三件事', '三件事：', '以本地生身份申加拿大名校', '加拿大本地生路径',
    '本地生路径', '凭12年级英语学分，多校', '英文学分常可免雅思',
    '常可免雅思/托福', '全英文可免雅思', '申请大学只看12',
    '这6门平均分=录取依据', '项维度OSSD领先', '确定性更高'
  ]) assert.ok(!normalize(html).includes(stale), stale);
  assert.ok(html.includes("neutral:true"));
  assert.ok(html.includes("!d.neutral && d.s.me > best"));
  assert.ok(html.includes("d.neutral?'逐校核对'"));
  requireText(normalize($('.vs2-note').text()), ['非官方数据', '不代表录取概率', '等长示意', '不作优劣评分']);
  assert.equal($('.vs2-score-num span').text(), '/ 3');
});

test('FAQ JSON-LD exactly matches all visible questions and answers', () => {
  const details = $('.ossd-faq details').toArray();
  assert.equal(details.length, 8);
  assert.equal(faqSchema.mainEntity.length, details.length);
  details.forEach((el, i) => {
    const entry = faqSchema.mainEntity[i];
    assert.equal(entry['@type'], 'Question');
    assert.equal(entry.name, $(el).find('summary').text());
    assert.equal(entry.acceptedAnswer['@type'], 'Answer');
    assert.equal(normalize(entry.acceptedAnswer.text), normalize($(el).find('.a').text()));
  });
});

test('metadata and maintained official source record are synchronized without a visible appendix', () => {
  const description = $('meta[name="description"]').attr('content');
  assert.equal($('meta[property="og:description"]').attr('content'), description);
  assert.equal($('meta[property="og:title"]').attr('content'), $('title').text());
  assert.equal(record.lastVerified, '2026-11-26');
  assert.deepEqual(record.sources.map(source => source.url), [officialUrl]);
  for (const kind of ['Article', 'WebPage']) {
    const schema = schemas.find(node => node['@type'] === kind);
    assert.equal(schema.description, description);
    assert.equal(schema.dateModified, record.lastVerified);
    assert.deepEqual(schema.citation, record.sources.map(source => source.url));
    assert.match(kind === 'Article' ? schema.headline : schema.name, /毕业要求与大学申请规则/);
  }
  assert.equal($('#ossd-sources, .seda-sources').length, 0);
  assert.doesNotMatch($('main').text(), /官方来源与核实日期|最近核实/);
  assert.doesNotMatch(description, /2026-11-26.*核实/);
  requireText(normalize(record.note), [
    '2026-11-18', 'Literacy graduation requirement',
    'Online learning graduation requirement', 'Opting out',
    'Financial literacy graduation requirement', 'Community involvement activities'
  ]);
  assert.match(description, /18\+12/);
  assert.match(description, /17\+13/);
});

test('original stylesheet, photography, illustration and interactive layout are retained', () => {
  assert.equal(createHash('sha256').update($('style').text()).digest('hex'),
    '00ac858e17ddcf5cdb6239eb2a36f29e0bf731add4cb0ab9a6da44a96be260d4');
  const photos = ['/assets/hero-mbs-day3.jpg', '/assets/nus-campus.jpg', '/assets/ntu-campus.jpg',
    '/assets/smu-campus.jpg', '/assets/hero-cambridge-alevel.jpg', '/assets/into-hero.jpg'];
  assert.deepEqual($('img').map((_, el) => $(el).attr('src')).get(),
    ['/assets/seda-wordmark.svg', ...photos, ...photos, '/assets/seda-wordmark.svg']);
  assert.equal($('svg').length, 25);
  assert.equal($('.iso-scene').length, 1);
  assert.equal($('.ossd-ring').length, 3);
  assert.equal($('.road2-panel').length, 4);
  assert.equal($('.cmp2-seg button').length, 4);
  assert.equal($('.ossd-film-imgs > div').length, 3);
});
