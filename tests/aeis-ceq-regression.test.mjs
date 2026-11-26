import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';

const html = fs.readFileSync(new URL('../aeis/aeis-primary-english-grammar-chinese-students/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../content/articles/aeis-primary-english-grammar-chinese-students.md', import.meta.url), 'utf8');
const $ = load(html);
const [, frontmatter, body] = source.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
const meta = Object.fromEntries(frontmatter.split('\n').map(line => {
  const separator = line.indexOf(':');
  return [line.slice(0, separator), line.slice(separator + 1).trim()];
}));
const canonical = 'https://sgeda.org.cn/aeis/aeis-primary-english-grammar-chinese-students/';
const officialUrls = [
  'https://www.moe.gov.sg/international-students/aeis/eligibility-criteria',
  'https://www.moe.gov.sg/international-students/aeis/test-details',
];
const normalize = text => text.replace(/\s+/g, ' ').trim();
const plainMarkdown = text => normalize(text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
const structured = $('script[type="application/ld+json"]').toArray().map(script => JSON.parse($(script).text()));
const schema = type => structured.find(item => item['@type'] === type);
const articleText = $('article.content-body').text();

for (const [label, text] of [['HTML正文', articleText], ['Markdown源稿', body]]) {
  test(`${label}: separates primary mathematics, CEQ eligibility and secondary subjects`, () => {
    assert.match(text, /当前小学 AEIS 只测数学/);
    assert.match(text, /提交[\s\S]*?申请前取得符合 MOE 要求的 CEQ 成绩/);
    assert.match(text, /CEQ 是英语前置资格/);
    assert.match(text, /中学 AEIS 则测试英语和数学/);
    assert.match(text, /语法[\s\S]*?不是[\s\S]*?小学 AEIS 英语[\s\S]*?考纲/);
    assert.match(text, /不代表 CEQ 官方考纲、题型分布或分值占比/);
  });

  test(`${label}: removes obsolete papers, unsupported percentages and effect promises`, () => {
    assert.doesNotMatch(text, /Paper\s*[12]|AEIS 官方样题中的 Grammar MCQ/i);
    assert.doesNotMatch(text, /\d+(?:\.\d+)?\s*[%％]/);
    assert.doesNotMatch(text, /失分率（估）|全军覆没|失分最高|失分最多|两周后|即可看到显著提升|覆盖全部高频考点/);
    assert.match(text, /不是提分承诺/);
  });
}

test('title, description, keywords and article identities match the source', () => {
  assert.equal($('head > title').length, 1);
  assert.equal($('head > title').text(), `${meta.title} | SEDA 新加坡择校网`);
  assert.equal($('main h1').length, 1);
  assert.equal($('main h1').text(), meta.title);
  assert.equal($('.breadcrumb span').last().text(), meta.title);
  assert.equal($('meta[name="description"]').attr('content'), meta.description);
  assert.equal($('.hero-subtitle').text(), meta.description);
  assert.equal($('meta[name="keywords"]').attr('content'), meta.keywords);
  assert.equal(schema('Article').headline, meta.title);
  assert.equal(schema('Article').description, meta.description);
  assert.equal(schema('Article').keywords, meta.keywords);
  assert.deepEqual(schema('Article').about, meta.keywords.split(','));
  assert.equal(schema('WebPage').name, meta.title);
  assert.equal(schema('WebPage').description, meta.description);
  assert.equal(schema('WebPage').mainEntity.headline, meta.title);
  assert.equal(schema('BreadcrumbList').itemListElement.at(-1).name, meta.title);
});

test('keeps the URL and original publication date while recording this correction', () => {
  assert.equal(meta.slug, 'aeis-primary-english-grammar-chinese-students');
  assert.equal(meta.date, '2026-09-19');
  assert.equal(meta.updated, '2026-11-26');
  assert.equal($('link[rel="canonical"]').attr('href'), canonical);
  assert.equal(schema('Article').mainEntityOfPage, canonical);
  assert.equal(schema('WebPage').url, canonical);
  assert.equal(schema('WebPage').mainEntity.url, canonical);
  for (const type of ['Article', 'WebPage']) {
    assert.equal(schema(type).datePublished, meta.date);
    assert.equal(schema(type).dateModified, meta.updated);
  }
  assert.equal($('meta[property="article:modified_time"]').attr('content'), meta.updated);
});

test('all JSON-LD blocks parse and maintain the intended types', () => {
  assert.equal(structured.length, 5);
  assert.deepEqual(structured.map(item => item['@type']).sort(), ['Article', 'BreadcrumbList', 'FAQPage', 'Organization', 'WebPage']);
  for (const item of structured) assert.equal(item['@context'], 'https://schema.org');
});

test('FAQ JSON-LD exactly matches the seven visible and source questions and answers', () => {
  const faq = body.split('## 常见问题\n\n')[1].split('\n## 资料来源与核实')[0];
  const sourceItems = [...faq.matchAll(/### (.+)\n\n([\s\S]*?)(?=\n### |$)/g)].map(([, question, answer]) => ({
    '@type': 'Question', name: question,
    acceptedAnswer: { '@type': 'Answer', text: normalize(answer) },
  }));
  assert.equal(sourceItems.length, 7);
  assert.deepEqual(schema('FAQPage').mainEntity, sourceItems);
  const headings = $('article.content-body > h3').toArray();
  assert.equal(headings.length, sourceItems.length);
  headings.forEach((heading, index) => {
    assert.equal($(heading).text(), sourceItems[index].name);
    assert.equal(normalize($(heading).next('p').text()), sourceItems[index].acceptedAnswer.text);
  });
  assert.doesNotMatch(JSON.stringify(schema('FAQPage')), /相关阅读|2025 年最新指南|Paper\s*2/);
});

test('retained grammar tables and headings match the Markdown without invented statistics', () => {
  const sourceTables = [...body.matchAll(/(?:^|\n)(\|[^\n]+\|(?:\n\|[^\n]+\|)+)/g)].map(([, table]) => table.split('\n')
    .filter(row => !/^\s*\|?\s*-{3,}/.test(row))
    .map(row => row.split('|').map(cell => cell.trim()).filter(Boolean).map(plainMarkdown)));
  const tables = $('article.content-body > .article-table table').toArray();
  assert.equal(tables.length, 6);
  assert.equal(sourceTables.length, tables.length);
  tables.forEach((table, index) => {
    const rows = $(table).find('tr').toArray().map(row => $(row).children('th,td').toArray().map(cell => normalize($(cell).text())));
    assert.deepEqual(rows, sourceTables[index]);
    assert.ok(rows.every(row => row.length === rows[0].length), `Table ${index + 1} has consistent columns`);
    assert.equal($(table).parent().attr('tabindex'), '0');
  });
  assert.deepEqual($('article.content-body > h2').toArray().map(heading => $(heading).text()), [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading));
  assert.match(articleText, /She is a teacher\./);
  assert.match(articleText, /He goes to school\./);
  assert.match(articleText, /I will arrive on Monday\./);
});

test('official sources and verification date are visible and cited in Article JSON-LD', () => {
  const sourcesHeading = $('article.content-body > h2').filter((_, heading) => $(heading).text() === '资料来源与核实');
  assert.equal(sourcesHeading.length, 1);
  assert.match(sourcesHeading.next('p').text(), /核实日期为 2026-11-26/);
  for (const url of officialUrls) {
    assert.equal(sourcesHeading.nextAll('ul').first().find(`a[href="${url}"]`).length, 1);
    assert.ok(body.includes(`](${url})`));
  }
  assert.deepEqual(schema('Article').citation, officialUrls);
});

test('preserves the static page shell, existing image assets and table presentation', () => {
  assert.equal($('html').attr('lang'), 'zh-CN');
  assert.equal($('header.site-header').length, 1);
  assert.equal($('main').length, 1);
  assert.equal($('article.content-body').length, 1);
  assert.equal($('footer.site-footer').length, 1);
  assert.equal($('link[rel="stylesheet"]').attr('href'), '/seda-site.css?v=45');
  assert.equal($('script[src="/seda-site.js?v=30"]').length, 1);
  assert.equal($('.related-article-grid a').length, 6);
  assert.equal($('section.cp-soft-cta').length, 1);
  assert.deepEqual($('article.content-body img').toArray().map(image => $(image).attr('src')), [
    '/assets/articles/aeis-primary-english-grammar-chinese-students-hero.jpg',
    '/assets/articles/aeis-primary-english-grammar-chinese-students-mid.jpg',
  ]);
  for (const image of $('article.content-body img').toArray()) {
    const src = $(image).attr('src');
    assert.ok(fs.existsSync(new URL(`..${src}`, import.meta.url)));
    assert.ok($(image).attr('alt'));
    assert.doesNotMatch($(image).attr('alt'), /占比|小学英文语法专项/);
  }
  const sourceImages = [...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)].map(([, alt, src]) => ({ alt, src }));
  assert.deepEqual($('article.content-body img').toArray().map(image => ({ alt: $(image).attr('alt'), src: $(image).attr('src') })), sourceImages);
});
