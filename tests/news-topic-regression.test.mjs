import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

// Read-only checks: do not import the builder, fetch URLs, or write generated files.
const root = fileURLToPath(new URL('../', import.meta.url));
const html = fs.readFileSync(path.join(root, 'news/index.html'), 'utf8');
const $ = load(html);
const cases = [
  {
    href: '/aeis/',
    title: '新加坡 AEIS 与 S-AEIS 入学指南',
    description: '了解 AEIS 与 S-AEIS 的报名条件、申请年级、考试内容及入学流程，区分小学 CEQ 英语要求与中学英语和数学测试。具体安排以当届官方说明为准。',
    terms: ['AEIS', 'S-AEIS'],
  },
  {
    href: '/guides/cost/',
    title: '新加坡留学一年多少钱？先算清学费与生活费',
    description: '按学生身份、学段与住宿安排梳理学费、生活费和首年额外支出，区分官方收费与家庭预算示例。实际费用需核对对应学年的学校收费单。',
    terms: ['留学', '学费', '生活费'],
  },
  {
    href: '/wace-atar/',
    title: 'WACE ATAR 成绩详解：计算方式与大学申请门槛',
    description: '了解 ATAR 的含义、计算流程、科目 Scaling 机制与大学申请要求。本专题介绍成绩与申请规则，不提供中国学生历年成绩统计；当期要求需逐校核对。',
    terms: ['WACE', 'ATAR', '计算'],
  },
  {
    href: '/o-level-jc/',
    title: 'O-Level 后读 JC（初级学院）完全指南',
    description: '梳理 O-Level 后进入 JC 的升学路径、L1R5 计分、选校考虑与 A-Level 课程衔接。录取要求和分数线需按申请年份核对，不作为某届放榜公告。',
    terms: ['O-Level', 'JC', '初级学院'],
  },
  {
    href: '/guides/student-pass/',
    title: '新加坡学生准证（Student Pass）申请完全指南',
    description: '了解学生准证的申请条件、材料准备、申请流程、费用与续签注意事项。本页为申请指南，并非政策变更公告；具体要求以 ICA 当前说明为准。',
    terms: ['学生准证', 'Student Pass', '申请'],
  },
  {
    href: '/o-level-poly/',
    title: 'O-Level 后读 Poly（理工学院）完全指南',
    description: '了解 ELR2B2 计分、五所理工学院、专业选择及毕业后的升学路径。录取参考分数需结合申请年份与专业要求核对，不作为某届分数线公布新闻。',
    terms: ['O-Level', 'Poly', '理工学院'],
  },
  {
    href: '/pathway/',
    title: '新加坡升学路径全攻略',
    description: '从年龄、英文水平和目标大学出发，对比政府学校、WACE 与国际学校等升学路径的入口、课程体系及大学出口，帮助家庭判断适合的方向。',
    terms: ['新加坡', '升学路径'],
  },
  {
    href: '/ib/',
    title: '新加坡 IB 课程完全攻略',
    description: '介绍 IBDP 六大学科组、核心组件、评分体系、新加坡学校选择与大学申请参考，帮助了解 IB 课程及适合的学生类型，不承诺提供历届学校成绩榜。',
    terms: ['新加坡', 'IB', '课程'],
  },
];

for (const { href, title, description, terms } of cases) {
  test(`旧卡片 ${href}：专题标题与落地一致，不伪装有日期的新闻`, () => {
    const link = $(`main .article-card > a[href="${href}"]`);
    assert.equal(link.length, 1, '每个旧卡片目标应保留一次');
    assert.equal(link.parent().attr('class'), 'article-card', '保留原卡片视觉类名');
    assert.equal(link.children('.tag').text().trim(), '相关专题');
    assert.equal(link.children('h3').length, 1);
    assert.equal(link.children('h3').text().trim(), title);
    assert.equal(link.children('p').length, 1);
    assert.equal(link.children('p').text().trim(), description);
    assert.equal(link.find('time, [datetime], [itemprop="datePublished"]').length, 0);
    assert.doesNotMatch(link.text(), /20\d{2}[-年]/, '专题不冒充某年新闻或发布日期');
    assert.doesNotMatch(link.text(), /15\s*[%％]|同比增长|创新高|表现亮眼|高分段分布|平均分继续领跑|已公布|分数线出炉|本文分析/);

    const targetFile = path.join(root, href.slice(1), 'index.html');
    assert.ok(fs.existsSync(targetFile), '保留可落地的站内链接');
    const target = load(fs.readFileSync(targetFile, 'utf8'));
    assert.equal(target('h1').length, 1, '落地专题有独立标题');
    for (const term of terms) {
      assert.ok(target('h1').text().includes(term), `落地标题应对应专题 ${term}`);
      assert.ok(title.includes(term), `卡片标题应对应专题 ${term}`);
    }
  });
}

test('资讯列表保留 24 张真实文章卡片及 8 张专题卡片的 HTML 链接', () => {
  const cards = $('main .article-grid > article.article-card');
  assert.equal(cards.length, 32);
  const topicRoutes = new Set(cases.map(({ href }) => href));
  const articleCards = cards.filter((_, card) => !topicRoutes.has($(card).children('a').attr('href')));
  assert.equal(articleCards.length, 24);
  for (const card of cards.toArray()) {
    const link = $(card).children('a');
    assert.equal(link.length, 1);
    assert.match(link.attr('href'), /^\/[a-z0-9/-]+\/$/);
    assert.ok(link.children('h3').text().trim());
    assert.ok(link.children('p').text().trim());
    assert.ok(fs.existsSync(path.join(root, link.attr('href').slice(1), 'index.html')));
  }
  for (const card of articleCards.toArray()) {
    assert.equal($(card).find('time').length, 1, '不删除真实文章日期');
    assert.match($(card).find('time').text().trim(), /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal((html.match(/<!-- GENERATED_ARTICLES_START -->/g) || []).length, 1);
  assert.equal((html.match(/<!-- GENERATED_ARTICLES_END -->/g) || []).length, 1);
  const generated = html.split('<!-- GENERATED_ARTICLES_START -->')[1].split('<!-- GENERATED_ARTICLES_END -->')[0];
  assert.equal(load(generated)('.article-card').length, 24, '真实文章仍位于原生成区');
  assert.equal(load(generated)('.tag').filter((_, el) => $(el).text() === '相关专题').length, 0);
});

test('资讯页 JSON-LD 可解析，专题不新增伪 Article 与 datePublished', () => {
  const data = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text()));
  assert.equal(data.length, 3);
  assert.deepEqual(data.map(item => item['@type']), ['CollectionPage', 'BreadcrumbList', 'Organization']);
  assert.equal(data[0].mainEntityOfPage, 'https://sgeda.org.cn/news/');
  assert.equal(data[1].itemListElement[1].name, '资讯');
  assert.doesNotMatch(JSON.stringify(data), /"datePublished"|"@type":"(?:Article|NewsArticle)"/);
});
