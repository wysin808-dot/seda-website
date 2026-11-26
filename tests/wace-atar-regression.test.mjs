import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { load } from 'cheerio';
import { parse } from 'parse5';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'wace-atar/index.html'), 'utf8');
const $ = load(html);
const sources = JSON.parse(fs.readFileSync(path.join(root, 'content/sources.json'), 'utf8'));
const record = sources['https://sgeda.org.cn/wace-atar/'];
const normalise = text => text.replace(/\s+/g, ' ').trim();
const schemas = $('script[type="application/ld+json"]').toArray().map(script => JSON.parse($(script).text()));
const schema = type => schemas.filter(item => item['@type'] === type);
const officialUrls = [
  'https://www.tisc.edu.au/static/guide/atar-about.tisc',
  'https://nus.edu.sg/oam/admissions/international-qualifications-for-foreigners/international-qualifications/australian-high-school',
  'https://www.ntu.edu.sg/admissions/undergraduate/admissions/general-admission-requirements/international-qualifications/australia-qualifications',
];
const singaporeHeading = $('article.content-main h3').filter((_, heading) => $(heading).text().startsWith('新加坡大学'));
const singaporeTable = singaporeHeading.next('.table-wrap').find('table');
const faqAnswers = new Map($('.faq-list details').toArray().map(detail => [
  normalise($(detail).find('summary').text()),
  normalise($(detail).find('p').text()),
]));

test('旧ATAR HTML可解析，原布局、资源及稳定URL保留', () => {
  const errors = [];
  parse(html, { onParseError: error => errors.push(error.code) });
  assert.deepEqual(errors, []);
  assert.equal($('html').attr('lang'), 'zh-CN');
  for (const selector of ['main', 'h1', '.site-header', '.site-footer', '.content-layout', 'article.content-main', 'aside.content-sidebar']) {
    assert.equal($(selector).length, 1, selector);
  }
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://sgeda.org.cn/wace-atar/');
  assert.equal($('link[rel="stylesheet"]').attr('href'), '/seda-site.css?v=45');
  assert.equal($('script[src="/seda-site.js?v=30"]').length, 1);
  assert.equal($('style').length, 0);
  assert.equal($('.page-hero').attr('class'), 'page-hero content-hero hero-pathway');
  assert.equal($('.faq-list details[open]').length, 1);
});

test('所有JSON-LD有效，FAQ只有一份且逐问逐答与可见内容一致', () => {
  assert.ok(schemas.length >= 5);
  for (const item of schemas) assert.equal(item['@context'], 'https://schema.org');
  assert.equal(schemas.length, 6);
  assert.equal(schema('FAQPage').length, 1);
  const entries = schema('FAQPage')[0].mainEntity;
  assert.equal(entries.length, 7);
  assert.equal(entries.length, faqAnswers.size);
  assert.equal(new Set(entries.map(entry => entry.name)).size, entries.length);
  for (const entry of entries) {
    assert.equal(entry['@type'], 'Question');
    assert.equal(entry.acceptedAnswer['@type'], 'Answer');
    assert.equal(normalise(entry.acceptedAnswer.text), faqAnswers.get(normalise(entry.name)), entry.name);
  }
});

test('NUS/NTU表格仅列已核实的90/95最低申请条件，不再列88/85专业线', () => {
  assert.equal(singaporeTable.length, 1);
  const rows = singaporeTable.find('tbody tr').toArray();
  assert.equal(rows.length, 2);
  for (const [index, university, threshold] of [[0, 'NUS', '90'], [1, 'NTU', '95']]) {
    const cells = $(rows[index]).find('td');
    assert.equal(normalise(cells.eq(0).text()), university);
    assert.match(cells.eq(1).text(), /国际申请者/);
    assert.equal(cells.eq(2).find('strong').text(), threshold);
    assert.match(cells.eq(2).text(), /不是专业录取线/);
    assert.doesNotMatch(cells.text(), /88\+|85\+|99\+|97\+|92\+/);
  }
  const note = singaporeTable.closest('.table-wrap').next('.info-box').text();
  assert.match(note, /公民.*PR.*另行核对/);
  assert.match(note, /个案审核.*未公布统一最低下限/);
  assert.match(note, /年度.*4 月 1 日.*LKCMedicine.*Renaissance Engineering Programme/);
  assert.match(note, /NUS.*尚待结业/);
});

test('ATAR 80 FAQ不暗示符合NUS/NTU国际申请资格，最低资格不保证录取', () => {
  const eighty = faqAnswers.get('ATAR 80 能申请什么大学？');
  assert.match(eighty, /国际申请者.*ATAR 80 未达到 NUS 最低 ATAR 90 或 NTU 最低 ATAR 95/);
  assert.match(eighty, /公民\/PR.*另行核对.*个案申请.*未公布统一下限/);
  assert.match(eighty, /不能仅凭 ATAR 80 承诺录取/);
  const guarantee = faqAnswers.get('达到 NUS 90 或 NTU 95 就能录取吗？');
  assert.match(guarantee, /最低申请资格.*不保证录取.*不是各专业的录取线/);
  assert.match(guarantee, /申请年度.*身份.*专业先修科目.*英语.*材料.*成绩公布时间/);
  assert.doesNotMatch(html, /ATAR 80 可以冲刺|NUS 热门专业通常需要 88/);
});

test('排名定义采用TISC西澳离校年龄人口，不保留全国20万人或固定名次', () => {
  const definition = faqAnswers.get('ATAR 是什么？');
  assert.match(definition, /TISC.*西澳.*Year 12 离校年龄人口/);
  assert.match(definition, /不是考试百分制分数/);
  const max = faqAnswers.get('ATAR 满分是多少？');
  assert.match(max, /99\.95.*西澳 Year 12 离校年龄人口/);
  assert.match(max, /不能据此推算.*固定名次/);
  assert.doesNotMatch(html, /全澳(?:约)?\s*(?:20\s*万|前\s*200|前\s*1%|前\s*5%|前\s*10%|前\s*20%|前\s*30%)|全澳 99\.95%|全澳 92\.50%|全澳 90%|TEA 在全澳考生中排名|全澳排名转百分位/);
  const rankTable = $('article.content-main .data-table').first();
  assert.match(rankTable.find('thead').text(), /西澳离校年龄人口/);
  assert.doesNotMatch(rankTable.text(), /可申请.*热门专业|可申请澳洲八大多数专业/);
});

test('TEA示例标明假设及当年规则，不再将329固定换算为ATAR92', () => {
  assert.match(html, /计算流程教学示例（分数为假设值）/);
  assert.match(html, /科目组合和加分规则/);
  assert.match(html, /LOTE.*Mathematics Methods.*Mathematics Specialist/);
  assert.match(html, /TISC 当前列出的 TEA 上限为 430/);
  assert.match(html, /使用完整 TEA 查对应年度换算资料/);
  assert.doesNotMatch(html, /TEA 329 → ATAR 约 92|第 5 门及以后的科目不计入 TEA/);
});

test('meta、Open Graph、Article与WebPage描述一致，含最低资格而不堆砌核实日期', () => {
  const description = $('meta[name="description"]').attr('content');
  assert.equal($('meta[property="og:description"]').attr('content'), description);
  assert.equal(schema('Article')[0].description, description);
  assert.equal(schema('WebPage').length, 1);
  assert.equal(schema('WebPage')[0].description, description);
  assert.match(description, /TISC 西澳.*NUS.*90.*NTU 国际申请者.*95/);
  assert.match(description, /公民\/PR.*年度与专业.*最低资格不保证录取/);
  assert.doesNotMatch(description, /核实于|2026-11-26/);
  for (const type of ['Article', 'WebPage']) {
    assert.equal(schema(type)[0].dateModified, record.lastVerified);
    assert.deepEqual(schema(type)[0].citation, officialUrls);
  }
  const summaries = $('meta[name="ai-summary"]').toArray().map(meta => $(meta).attr('content')).join(' ');
  assert.match(summaries, /TISC 西澳.*90.*95.*最低申请资格不保证录取/);
});

test('来源-only区块完全移除，真实具体URL及核实范围保存在维护记录与citation', () => {
  assert.equal($('#atar-official-sources, .seda-sources').length, 0);
  assert.doesNotMatch($('main').text(), /资料来源与核实|核实于 2026-11-26/);
  assert.equal(record.lastVerified, '2026-11-26');
  assert.deepEqual(record.sources.map(source => source.url), officialUrls);
  assert.match(record.note, /最低资格不保证录取.*身份.*申请年度.*目标专业/);
  for (const source of record.sources) assert.ok(source.label.trim());
  assert.equal($('footer a.footer-contact-link[href="/contact/"]').length, 1, '已有联系入口仍可咨询或纠错');
});

test('页面可执行的内联脚本语法正常，不执行分析或外部脚本', () => {
  $('script:not([src]):not([type="application/ld+json"])').each((_, script) => {
    assert.doesNotThrow(() => new vm.Script($(script).text()));
  });
});

test('SEO增强脚本连续两次运行不覆盖旧ATAR整页、已核实摘要或唯一FAQ', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-atar-build-'));
  const fixturePage = path.join(fixtureRoot, 'wace-atar/index.html');
  const controlPage = path.join(fixtureRoot, 'wace-vs-a-level/index.html');
  const controlHtml = '<!doctype html><html><head><title>对照页面</title><meta name="description" content="对照页面实际描述"></head><body><main><h1>对照页面</h1></main></body></html>\n';
  try {
    fs.mkdirSync(path.dirname(fixturePage), { recursive: true });
    fs.mkdirSync(path.dirname(controlPage), { recursive: true });
    fs.writeFileSync(fixturePage, html);
    fs.writeFileSync(controlPage, controlHtml);
    for (let run = 1; run <= 2; run += 1) {
      // The real enhancer captures cwd as its root: only temporary fixtures are writable.
      const output = execFileSync(process.execPath, [path.join(root, 'scripts/enhance-key-seo-pages.mjs')], {
        cwd: fixtureRoot,
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.match(output, /Enhanced 1 key SEO pages\./, '对照页必须实际经过增强，不能停用整个脚本');
      assert.equal(fs.readFileSync(fixturePage, 'utf8'), html, `第${run}次运行不得改动旧ATAR任何字节`);
      const control = fs.readFileSync(controlPage, 'utf8');
      assert.notEqual(control, controlHtml);
      const controlSchemas = load(control)('script[type="application/ld+json"]').toArray();
      assert.equal(controlSchemas.length, 1, '没有可见FAQ或核心列表的页面不得注入虚构问答或列表');
      const entity = JSON.parse(load(controlSchemas[0]).text());
      assert.equal(entity['@type'], 'WebPage');
      assert.equal(entity.name, '对照页面', '增强读取实际标题而非独立文案模板');
      assert.equal(entity.description, '对照页面实际描述');
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
