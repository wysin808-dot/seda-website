import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = fs.readFileSync(path.join(root, 'news/index.html'), 'utf8');
const $ = load(html);
const topics = [
  ['/aeis/', 'AEIS 与 S-AEIS 入学', ['AEIS', 'S-AEIS']],
  ['/guides/cost/', '留学费用与预算', ['留学', '学费']],
  ['/wace-atar/', 'WACE 与 ATAR 计分', ['WACE', 'ATAR']],
  ['/o-level-jc/', 'O-Level 后读 JC', ['O-Level', 'JC']],
  ['/guides/student-pass/', '学生准证申请', ['学生准证', '申请']],
  ['/o-level-poly/', 'O-Level 后读 Poly', ['O-Level', 'Poly']],
  ['/pathway/', '升学路径总览', ['升学路径']],
  ['/ib/', 'IB 课程', ['IB', '课程']],
];

for (const [href, label, terms] of topics) {
  test(`专题入口 ${href}：独立于文章目录，保留真实目标且不伪装新闻`, () => {
    const link = $(`.news-topics .news-topic-links a[href="${href}"]`);
    assert.equal(link.length, 1);
    assert.equal(link.text().trim(), label);
    assert.equal(link.closest('.news-archive').length, 0);
    assert.equal(link.find('time,[datetime],[itemprop="datePublished"]').length, 0);
    assert.doesNotMatch(link.text(), /20\d{2}[-年]|15\s*[%％]|同比增长|创新高|表现亮眼|已公布|分数线出炉/);
    const file = path.join(root, href.slice(1), 'index.html');
    assert.ok(fs.existsSync(file));
    const target = load(fs.readFileSync(file, 'utf8'));
    assert.equal(target('h1').length, 1);
    for (const term of terms) assert.ok(target('h1').text().includes(term), `专题目标对应 ${term}`);
  });
}

function publications() {
  return fs.readdirSync(path.join(root, 'content/articles')).filter(file => file.endsWith('.md') && !file.startsWith('_')).flatMap(file => {
    const raw = fs.readFileSync(path.join(root, 'content/articles', file), 'utf8');
    const fields = raw.match(/^---\n([\s\S]*?)\n---/)[1];
    const meta = Object.fromEntries(fields.split('\n').filter(line => line.includes(':')).map(line => {
      const at = line.indexOf(':');
      const value = line.slice(at + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      return [line.slice(0, at).trim(), value];
    }));
    if (meta.draft === 'true') return [];
    return [{ ...meta, url: `/${meta.category}/${meta.slug}/` }];
  });
}

test('新闻目录按真实主题显示全部文章，不截断为24篇或混入8个长期专题', () => {
  const expected = publications();
  const rows = $('.news-archive .news-article');
  assert.equal(rows.length, expected.length);
  assert.ok(rows.length > 24);
  assert.equal($('.news-topics .news-topic-links a').length, topics.length);
  assert.equal($('.article-grid,.article-card').length, 0);
  assert.equal($('.news-category[hidden],.news-category[aria-hidden="true"]').length, 0);
  assert.equal($('.news-category').length, new Set(expected.map(item => item.category)).size);
  for (const item of expected) {
    const link = $(`.news-archive .news-article h3 a[href="${item.url}"]`);
    assert.equal(link.length, 1);
    assert.equal(link.text().trim(), item.title);
    assert.equal(link.closest('.news-category').attr('data-news-category'), item.category);
    const time = link.closest('.news-article').find('time');
    assert.equal(time.text(), item.date);
    assert.equal(time.attr('datetime'), item.date);
    assert.ok(fs.existsSync(path.join(root, item.url.slice(1), 'index.html')));
  }
  assert.equal((html.match(/<!-- GENERATED_ARTICLES_START -->/g) || []).length, 1);
  assert.equal((html.match(/<!-- GENERATED_ARTICLES_END -->/g) || []).length, 1);
  const generated = html.split('<!-- GENERATED_ARTICLES_START -->')[1].split('<!-- GENERATED_ARTICLES_END -->')[0];
  assert.equal(load(generated)('.news-article').length, expected.length);
  assert.equal(load(generated)('.news-topics').length, 0);
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://sgeda.org.cn/news/');
  assert.equal($('link[href="/news/news.css?v=1"]').length, 1);
  assert.equal($('script[src="/news/news.js?v=1"][defer]').length, 1);
});

test('新闻页ItemList与实际文章对应，不给专题伪造Article、图片或发布日期', () => {
  const data = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text()));
  assert.deepEqual(data.map(item => item['@type']), ['CollectionPage', 'BreadcrumbList', 'Organization', 'ItemList']);
  const collection = data[0];
  assert.equal(collection.mainEntityOfPage, 'https://sgeda.org.cn/news/');
  assert.equal(collection.name, $('h1').text());
  assert.equal(collection.description, $('meta[name="description"]').attr('content'));
  assert.equal(data[1].itemListElement[1].name, '资讯');
  const list = data.find(item => item['@type'] === 'ItemList');
  const links = $('.news-article h3 a').toArray().map(el => ({ url: `https://sgeda.org.cn${$(el).attr('href')}`, name: $(el).text() }));
  assert.equal(list.numberOfItems, links.length);
  assert.deepEqual(list.itemListElement.map(({ url, name }) => ({ url, name })), links);
  assert.equal(collection.mainEntity['@id'], list['@id']);
  assert.doesNotMatch(JSON.stringify(data), /"datePublished"|"@type":"(?:Article|NewsArticle)"/);
});
