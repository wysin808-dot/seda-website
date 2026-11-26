import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { applySources } from '../scripts/enhance-eeat.mjs';

const root = path.resolve(import.meta.dirname, '..');
const canonical = 'https://sgeda.org.cn/example/';
const record = {
  lastVerified: '2026-11-26',
  note: '已有官方资料的维护记录；仅核对实际使用的政策，不代表全部学校已复核。',
  sources: [{ label: 'MOE — AEIS 申请资格', url: 'https://www.moe.gov.sg/international-students/aeis/eligibility-criteria' }],
};
const expectedCitation = record.sources.map(source => source.url);
const legacyBlock = '<!-- SEDA_SOURCES_START -->\n<section class="seda-sources"><details><summary>资料来源</summary><p>核实于 2026-11-26</p></details></section>\n<!-- SEDA_SOURCES_END -->\n';
const legacyStyle = '<!-- SEDA_SOURCES_STYLE_START -->\n<style>.seda-sources details{border-top:1px solid #eee}</style>\n<!-- SEDA_SOURCES_STYLE_END -->\n';
const jsonLd = node => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
const entities = html => {
  const $ = load(html);
  return $('script[type="application/ld+json"]').toArray().flatMap(script => {
    const data = JSON.parse($(script).text());
    return Array.isArray(data) ? data : (data['@graph'] || [data]);
  });
};

function withFixture(html, run, config = { [canonical]: record }) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-sources-'));
  const file = path.join(fixture, 'example/index.html');
  try {
    fs.mkdirSync(path.join(fixture, 'content'), { recursive: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'content/sources.json'), JSON.stringify(config, null, 2) + '\n');
    fs.writeFileSync(file, html);
    run({ fixture, file, read: () => fs.readFileSync(file, 'utf8') });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function assertNoLegacy(html) {
  assert.doesNotMatch(html, /SEDA_SOURCES_(?:START|END|STYLE_START|STYLE_END)|seda-sources/);
}

test('applySources removes every old visible/details/style block, synchronizes Article and WebPage, and is byte-idempotent', () => {
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: '实际文章', datePublished: '2026-09-19', citation: ['https://example.org/stale'] },
    { '@type': ['WebPage', 'CreativeWork'], url: canonical, description: '实际政策说明', datePublished: '2026-09-19' },
    { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: '实际问题', acceptedAnswer: { '@type': 'Answer', text: '实际回答' } }] },
  ] };
  const body = `<main><h1>实际文章</h1><p>发表日期：<time datetime="2026-09-19">2026-09-19</time>；2027 入学政策、2026 学费年度。</p><p><a href="${expectedCitation[0]}">正文必要政策链接</a></p></main>`;
  const html = `<!doctype html><html><head><style>.original{color:red}</style>${legacyStyle}${legacyStyle}${jsonLd(graph)}</head><body>${body}${legacyBlock}${legacyBlock}<footer>联系入口</footer></body></html>\n`;
  withFixture(html, ({ fixture, read }) => {
    const configBefore = fs.readFileSync(path.join(fixture, 'content/sources.json'), 'utf8');
    const first = applySources(fixture);
    assert.deepEqual(first, { updated: 1, total: 1, issues: [] });
    const after = read();
    assertNoLegacy(after);
    assert.ok(after.includes(body), 'body, annual policy/fees, publication date and useful official link remain byte-identical');
    assert.ok(after.includes('<style>.original{color:red}</style>'), 'unrelated style is preserved');
    const nodes = entities(after);
    for (const node of nodes.slice(0, 2)) {
      assert.deepEqual(node.citation, expectedCitation);
      assert.equal(node.dateModified, record.lastVerified);
      assert.equal(node.datePublished, '2026-09-19');
    }
    assert.equal(nodes[0].headline, '实际文章');
    assert.equal(nodes[1].description, '实际政策说明');
    assert.deepEqual(nodes[2], graph['@graph'][2], 'FAQ must not be rewritten');
    assert.deepEqual(applySources(fixture), { updated: 0, total: 1, issues: [] });
    assert.equal(read(), after);
    assert.deepEqual(applySources(fixture, { checkOnly: true }), { updated: 0, total: 1, issues: [] });
    assert.equal(read(), after);
    assert.equal(fs.readFileSync(path.join(fixture, 'content/sources.json'), 'utf8'), configBefore, 'verification records are not generated or redated');
  });
});

test('a page without a primary entity gets only a cited WebPage, without requiring main/footer or visible styles', () => {
  withFixture('<!doctype html><html><head><title>实际页面</title></head><body><p>实际内容</p></body></html>\n', ({ fixture, read }) => {
    assert.deepEqual(applySources(fixture), { updated: 1, total: 1, issues: [] });
    const after = read();
    assertNoLegacy(after);
    const $ = load(after);
    assert.equal($('style, details, section, footer').length, 0);
    const nodes = entities(after);
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0]['@type'], 'WebPage');
    assert.equal(nodes[0].url, canonical);
    assert.deepEqual(nodes[0].citation, expectedCitation);
    assert.equal(nodes[0].dateModified, record.lastVerified);
    assert.equal(nodes[0].datePublished, undefined, 'do not invent publication dates');
    assert.deepEqual(applySources(fixture), { updated: 0, total: 1, issues: [] });
    assert.equal(read(), after);
  });
});

test('--check validates real records and citations, not presence/absence of the legacy visible block, and never writes', () => {
  const entity = { '@context': 'https://schema.org', '@type': 'Article', citation: expectedCitation, dateModified: record.lastVerified };
  for (const oldMarkup of ['', legacyBlock + legacyStyle]) {
    const html = `<!doctype html><html><head>${jsonLd(entity)}</head><body><p>实际内容</p>${oldMarkup}</body></html>\n`;
    withFixture(html, ({ fixture, read }) => {
      assert.deepEqual(applySources(fixture, { checkOnly: true }), { updated: 0, total: 1, issues: [] });
      assert.equal(read(), html);
    });
  }
});

test('--check detects missing/stale/misdated citations and malformed JSON-LD instead of accepting a visible block', () => {
  for (const [node, pattern] of [
    [{ '@type': 'Article', dateModified: record.lastVerified }, /citation 与维护记录不一致/],
    [{ '@type': 'WebPage', citation: ['https://example.org/stale'], dateModified: record.lastVerified }, /citation 与维护记录不一致/],
    [{ '@type': 'CollectionPage', citation: expectedCitation, dateModified: '2026-01-01' }, /dateModified 与维护记录不一致/],
    [{ '@type': 'FAQPage' }, /缺 Article\/WebPage citation 实体/],
  ]) {
    const html = `<html><head>${jsonLd(node)}</head><body>${legacyBlock}</body></html>`;
    withFixture(html, ({ fixture, read }) => {
      const result = applySources(fixture, { checkOnly: true });
      assert.match(result.issues.join('\n'), pattern);
      assert.equal(result.updated, 0);
      assert.equal(read(), html);
    });
  }
  withFixture('<html><head><script type="application/ld+json">{bad JSON}</script></head></html>', ({ fixture }) => {
    assert.match(applySources(fixture, { checkOnly: true }).issues.join('\n'), /无效 JSON-LD/);
  });
});

test('invalid maintenance dates, missing scope, invalid/duplicate source URLs and missing pages fail record checks', () => {
  for (const [entry, pattern] of [
    [{ ...record, lastVerified: '2026-02-30' }, /无效 lastVerified/],
    [{ ...record, lastVerified: 'today' }, /无效 lastVerified/],
    [{ ...record, note: '' }, /缺核实范围记录/],
    [{ ...record, sources: [] }, /缺真实来源记录/],
    [{ ...record, sources: [{ label: '', url: 'javascript:alert(1)' }] }, /无效来源记录/],
    [{ ...record, sources: [...record.sources, ...record.sources] }, /重复来源记录/],
  ]) {
    withFixture('<html><head></head><body>实际内容</body></html>', ({ fixture, read }) => {
      const before = read();
      assert.match(applySources(fixture, { checkOnly: true }).issues.join('\n'), pattern);
      assert.equal(read(), before);
    }, { [canonical]: entry });
  }
  withFixture('<html></html>', ({ fixture }) => {
    assert.match(applySources(fixture, { checkOnly: true }).issues.join('\n'), /无效页面 canonical/);
  }, { 'https://example.org/example/': record });
  withFixture('<html></html>', ({ fixture, file }) => {
    fs.unlinkSync(file);
    assert.match(applySources(fixture, { checkOnly: true }).issues.join('\n'), /缺页面/);
  });
});

test('historically marked pages no longer registered are still cleaned without creating new facts or citations', () => {
  withFixture('<html><head></head><body>实际内容</body></html>', ({ fixture }) => {
    const retired = path.join(fixture, 'retired/index.html');
    fs.mkdirSync(path.dirname(retired));
    const content = '<!doctype html><html><head></head><body><p>未核实学校事实不改变</p></body></html>\n';
    fs.writeFileSync(retired, content.replace('</head>', `${legacyStyle}</head>`).replace('</body>', `${legacyBlock}</body>`));
    assert.equal(applySources(fixture).updated, 2);
    assert.equal(fs.readFileSync(retired, 'utf8'), content);
    assert.deepEqual(entities(content), [], 'do not fabricate citations for unregistered pages');
    assert.equal(applySources(fixture).updated, 0);
  });
});

test('all registered site pages keep real records and Article/WebPage citations with no visible injected blocks or styles', () => {
  const configFile = path.join(root, 'content/sources.json');
  const configText = fs.readFileSync(configFile, 'utf8');
  const config = JSON.parse(configText);
  const before = new Map(Object.entries(config).filter(([url]) => !url.startsWith('_')).map(([url, entry]) => {
    assert.ok(entry.note.trim());
    const file = path.join(root, new URL(url).pathname, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    assertNoLegacy(html);
    const $ = load(html);
    $('script, style').remove();
    assert.doesNotMatch($('body').text(), /(?:核实于|核对日期|最近核实)[：:为\s]*\d{4}-\d{2}-\d{2}/, 'verification dates stay in maintenance records, not repeated inline');
    return [file, html];
  }));
  assert.deepEqual(applySources(root, { checkOnly: true }), { updated: 0, total: before.size, issues: [] });
  for (const [file, html] of before) assert.equal(fs.readFileSync(file, 'utf8'), html);
  assert.equal(fs.readFileSync(configFile, 'utf8'), configText);
});

test('manual source-only blocks and their dead TOC links disappear; editorial explanation and Kong Hwa facts remain accurate', () => {
  for (const [route, id] of [['pathway', 'sources'], ['guides/student-pass', 'official-sources'], ['ossd', 'ossd-sources'], ['wace-atar', 'atar-official-sources']]) {
    const $ = load(fs.readFileSync(path.join(root, route, 'index.html'), 'utf8'));
    assert.equal($(`#${id}, a[href="#${id}"]`).length, 0, route);
  }
  const about = load(fs.readFileSync(path.join(root, 'about/index.html'), 'utf8'));
  assert.match(about('#editorial').text(), /保存在内容维护记录中/);
  assert.doesNotMatch(about('#editorial').text(), /设有「资料来源与核实」区块|见各页来源区块/);
  assert.equal(about('#editorial a[href="/contact/"]').length, 1);
  const kongHwa = load(fs.readFileSync(path.join(root, 'primary-schools/kong-hwa/index.html'), 'utf8'));
  assert.doesNotMatch(kongHwa('.hero-subtitle').text(), /核实于|2026-11-26/);
  for (const fact of ['350 Guillemard Road, Singapore 399772', 'Geylang', 'Every Kong Hwaian an Effective Communicator', 'Exposure-Experience-Excel through Sports', '1951', '1953', '1957', '1992', '2023']) {
    assert.ok(kongHwa('main').text().includes(fact), fact);
  }
  assert.equal(kongHwa('main a[href="https://www.konghwa.moe.edu.sg/about-khs/contact-us/"]').length, 1);
  assert.equal(kongHwa('main a[href="https://www.moe.gov.sg/schoolfinder/schooldetail/kong-hwa-school"]').length, 1);
  assert.equal(kongHwa('main a[href="https://www.konghwa.moe.edu.sg/about-khs/school-history/"]').length, 1);
});

test('fee-source inline verification dates disappear in Markdown and HTML while policy dates, annual fees, official links and publication remain', () => {
  const route = 'international-school/singapore-international-school-fees';
  const markdown = fs.readFileSync(path.join(root, 'content/articles/international-school-singapore-international-school-fees.md'), 'utf8');
  const html = fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
  const $ = load(html);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'content/sources.json'), 'utf8'));
  const maintained = config[`https://sgeda.org.cn/${route}/`];
  assert.equal(maintained.lastVerified, '2026-11-25');
  assert.match(markdown, /^date: 2026-06-02$/m);
  assert.doesNotMatch(markdown, /核实于|核对日期/);
  assert.doesNotMatch($('article.content-body').text(), /核实于|核对日期/);
  for (const source of maintained.sources) {
    assert.ok(markdown.includes(`](${source.url})`), source.label);
    assert.equal($(`article.content-body a[href="${source.url}"]`).length, 1, source.label);
  }
  for (const fact of ['AY26/27', '2026/2027', '2026 年 4 月 15 日', 'S$53,210', 'S$51,240', 'S$46,866']) {
    assert.ok(markdown.includes(fact), fact);
    assert.ok($('article.content-body').text().includes(fact), fact);
  }
  for (const node of entities(html).filter(item => ['Article', 'WebPage'].includes(item['@type']))) {
    assert.equal(node.datePublished, '2026-06-02');
    assert.equal(node.dateModified, maintained.lastVerified);
    assert.deepEqual(node.citation, maintained.sources.map(source => source.url));
  }
});
