import assert from 'node:assert/strict';
import test from 'node:test';
import { renderNewsArchive } from '../scripts/render-news-index.mjs';

function article(index, category = 'guides', overrides = {}) {
  const { meta = {}, ...rest } = overrides;
  return {
    meta: {
      title: `文章 ${index}`,
      description: `文章 ${index} 的原始描述`,
      category,
      categoryLabel: category === 'guides' ? '留学指南' : `${category} 原始标签`,
      date: `2026-10-${String(index % 28 + 1).padStart(2, '0')}`,
      updated: '2026-11-26',
      draft: false,
      ...meta,
    },
    url: `/${category}/article-${index}/`,
    summary: `文章 ${index} 的原始摘要`,
    ...rest,
  };
}

function decodeHtml(value) {
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  })[entity]);
}

function extractSchema(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'only the non-executable ItemList script is emitted');
  assert.match(scripts[0][1], /\btype="application\/ld\+json"/);
  assert.match(scripts[0][1], /\bid="news-article-list-schema"/);
  return JSON.parse(scripts[0][2]);
}

function articleLinks(html) {
  return [...html.matchAll(/<h3><a href="([^"]*)">([\s\S]*?)<\/a><\/h3>/g)]
    .map(match => ({ url: decodeHtml(match[1]), name: decodeHtml(match[2]) }));
}

function categorySections(html) {
  return [...html.matchAll(/<section class="news-category"([^>]*)>([\s\S]*?)<\/section>/g)]
    .map(match => ({
      attributes: match[1],
      category: decodeHtml(match[1].match(/data-news-category="([^"]*)"/)[1]),
      html: match[2],
    }));
}

function assertMatchingSchema(html) {
  const schema = extractSchema(html);
  const links = articleLinks(html);
  assert.equal(schema['@context'], 'https://schema.org');
  assert.equal(schema['@type'], 'ItemList');
  assert.equal(schema.numberOfItems, links.length);
  assert.equal(schema['@id'], 'https://sgeda.org.cn/news/#articles');
  assert.deepEqual(schema.itemListElement.map(({ url, name }) => ({ url, name })), links.map(({ url, name }) => ({ url: `https://sgeda.org.cn${url}`, name })));
  schema.itemListElement.forEach((item, index) => {
    assert.equal(item['@type'], 'ListItem');
    assert.equal(item.position, index + 1);
  });
  assert.doesNotMatch(JSON.stringify(schema), /"(?:datePublished|dateModified|image)"|"@type":"Article"/);
  return schema;
}

for (const count of [30, 85]) {
  test(`${count}-article fixture is complete, visible without JS and has one link per URL`, () => {
    const categories = ['guides', 'aeis', 'wace', 'o-level', 'international-school'];
    const fixtures = Array.from({ length: count }, (_, index) => article(index, categories[index % categories.length]));
    const html = renderNewsArchive(fixtures);
    assert.match(html, /^<div class="news-archive" id="news-articles">/);
    assert.match(html, /<nav class="news-filters" aria-label="按主题查看文章">/);
    assert.match(html, /<a href="#news-articles" data-news-filter="all" class="is-active" aria-current="true" data-news-label="全部文章">全部/);
    assert.match(html, new RegExp(`<p class="news-result-count" data-news-count aria-live="polite">共 ${count} 篇文章</p>`));
    assert.match(html, /<div class="news-category-list">/);
    assert.equal(articleLinks(html).length, count);
    assert.equal((html.match(/<article class="news-article">/g) || []).length, count);
    assert.equal((html.match(/<div class="news-article-list">/g) || []).length, categories.length);
    assert.doesNotMatch(html, /\bhidden(?:\s|=|>)|aria-hidden|\bstyle=|<style\b|\bon[a-z]+=|\bsrc=/i);
    assert.doesNotMatch(html, /href="\/news\//);
    for (const fixture of fixtures) {
      assert.equal(articleLinks(html).filter(link => link.url === fixture.url).length, 1);
      const allHrefs = [...html.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map(match => decodeHtml(match[1]));
      assert.equal(allHrefs.filter(url => url === fixture.url).length, 1);
    }
    assertMatchingSchema(html);
  });
}

test('only real categories appear, with priority order, original labels and correct counts', () => {
  const fixtures = [
    article(1, 'guides', { meta: { title: 'MOE 政策新闻 O-Level WACE AEIS', categoryLabel: '留学指南' } }),
    article(2, 'other-path', { meta: { categoryLabel: '' } }),
    article(3, 'wace', { meta: { categoryLabel: '不能覆盖 WACE' } }),
    article(4, 'aeis'),
    article(5, 'o-level'),
    article(6, 'o-level'),
  ];
  const html = renderNewsArchive(fixtures);
  const sections = categorySections(html);
  assert.deepEqual(sections.map(section => section.category), ['o-level', 'wace', 'aeis', 'guides', 'other-path']);
  const labels = new Map([['o-level', 'O-Level'], ['wace', 'WACE'], ['aeis', 'AEIS'], ['guides', '留学指南'], ['other-path', 'other-path']]);
  for (const section of sections) {
    const count = fixtures.filter(item => item.meta.category === section.category).length;
    assert.equal(articleLinks(section.html).length, count);
    assert.match(section.attributes, new RegExp(`id="news-${section.category}"`));
    assert.match(section.attributes, new RegExp(`aria-labelledby="news-${section.category}-heading"`));
    assert.ok(html.includes(`<a href="#news-${section.category}" data-news-filter="${section.category}" data-news-label="${labels.get(section.category)}">${labels.get(section.category)} <span class="news-filter-count">（${count}）</span></a>`));
    assert.ok(section.html.includes(`<h2 id="news-${section.category}-heading">${labels.get(section.category)} <span class="news-category-count">（${count} 篇）</span></h2>`));
  }
  const guides = sections.find(section => section.category === 'guides');
  assert.equal(articleLinks(guides.html)[0].url, fixtures[0].url, 'keywords never move an article into a guessed category');
  assert.doesNotMatch(html, /data-news-category="(?:policy|news|policies)"/);
  assertMatchingSchema(html);
});

test('missing priority categories are not invented', () => {
  const html = renderNewsArchive([article(1, 'guides')]);
  assert.deepEqual(categorySections(html).map(section => section.category), ['guides']);
  for (const category of ['o-level', 'wace', 'aeis']) {
    assert.ok(!html.includes(`data-news-filter="${category}"`));
  }
});

test('publication date controls sorting and time; updated and publishedAt cannot reorder it', () => {
  const older = article(1, 'o-level', { meta: { date: '2024-01-02', updated: '2099-12-31', publishedAt: '2099-12-31' } });
  const newer = article(2, 'o-level', { meta: { date: '2026-05-06', updated: '2020-01-01' } });
  const tied = article(3, 'o-level', { meta: { date: '2026-05-06', updated: '2100-01-01' } });
  const html = renderNewsArchive([older, newer, tied]);
  assert.deepEqual(articleLinks(html).map(link => link.url), [newer.url, tied.url, older.url]);
  assert.deepEqual([...html.matchAll(/<time datetime="([^"]*)">([^<]*)<\/time>/g)].map(match => [match[1], match[2]]), [
    ['2026-05-06', '2026-05-06'], ['2026-05-06', '2026-05-06'], ['2024-01-02', '2024-01-02'],
  ]);
  assert.doesNotMatch(html, /2099|2100|2020/);
  assertMatchingSchema(html);
});

test('drafts are excluded and the first published duplicate URL wins across categories', () => {
  const first = article(1, 'guides', { url: '/guides/shared/' });
  const duplicate = article(2, 'wace', { url: first.url, meta: { date: '2099-01-01', title: '重复文章应被排除' } });
  const drafts = [
    article(3, 'aeis', { meta: { draft: true } }),
    article(4, 'o-level', { meta: { draft: 'true' } }),
    article(5, 'draft-only', { meta: { draft: true }, url: first.url }),
    article(6, 'draft-only', { meta: { draft: true }, url: 'javascript:alert(1)' }),
  ];
  const html = renderNewsArchive([drafts[2], first, duplicate, ...drafts]);
  assert.deepEqual(articleLinks(html), [{ url: first.url, name: first.meta.title }]);
  assert.deepEqual(categorySections(html).map(section => section.category), ['guides']);
  assert.match(html, /共 1 篇文章/);
  assert.doesNotMatch(html, /重复文章应被排除|2099|draft-only|javascript:/);
  assertMatchingSchema(html);
});

test('metadata is escaped as text and ItemList JSON cannot close its script', () => {
  const category = 'custom"><svg/onload=alert(1)>';
  const label = '<img src=x onerror="alert(2)"> & \'原标签\'';
  const title = '</script><script>alert("标题")</script> & \'原文\'\u2028\u2029';
  const description = '<img src=x onerror="alert(3)"> & \'描述\'';
  const fixture = article(1, category, {
    url: '/guides/原文/?a=1&b=2',
    meta: { title, description, categoryLabel: label },
  });
  const html = renderNewsArchive([fixture]);
  assert.ok(html.includes('&lt;/script&gt;&lt;script&gt;alert(&quot;标题&quot;)&lt;/script&gt; &amp; &#39;原文&#39;'));
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(3)&quot;&gt; &amp; &#39;描述&#39;'));
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(2)&quot;&gt; &amp; &#39;原标签&#39;'));
  assert.ok(html.includes('data-news-category="custom&quot;&gt;&lt;svg/onload=alert(1)&gt;"'));
  assert.ok(html.includes('href="/guides/原文/?a=1&amp;b=2"'));
  assert.doesNotMatch(html, /<img\b|<svg\b|<script>alert/);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  const scriptBody = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(scriptBody, /[<>&\u2028\u2029]/);
  assert.equal(categorySections(html)[0].category, category);
  const schema = assertMatchingSchema(html);
  assert.equal(schema.itemListElement[0].name, title);
  assert.equal(schema.itemListElement[0].url, `https://sgeda.org.cn${fixture.url}`);
});

test('description has priority, summary is the fallback, and empty content emits no paragraph', () => {
  const html = renderNewsArchive([
    article(1, 'guides', { meta: { description: '保留原始描述' }, summary: '不使用的摘要' }),
    article(2, 'guides', { meta: { description: '   ' }, summary: '<b>原摘要</b> & "内容"' }),
    article(3, 'guides', { meta: { description: '' }, summary: ' \t ' }),
  ]);
  assert.ok(html.includes('<p class="news-article-description">保留原始描述</p>'));
  assert.ok(html.includes('<p class="news-article-description">&lt;b&gt;原摘要&lt;/b&gt; &amp; &quot;内容&quot;</p>'));
  assert.doesNotMatch(html, /不使用的摘要|<b>原摘要/);
  assert.equal((html.match(/<p class="news-article-description">/g) || []).length, 2);
});

test('unsafe or malformed published URLs throw instead of entering HTML or schema', () => {
  const unsafeUrls = [
    'https://evil.example/article/', '//evil.example/article/', 'javascript:alert(1)',
    'guides/article/', '/" onclick="alert(1)', "/' onclick='alert(1)",
    '/<script>/', '/`bad`/', '/\\evil.example/', '/a\nb/', '/a\rb/', '/a\tb/',
    '/a\u0000b/', '/a\u007fb/', '/a\u0085b/', '/a b/', '/%0aevil/', '/%22evil/',
    '/%27evil/', '/%5cevil/', '/%2fevil.example/', '/%2f%2fevil.example/',
    '/guides/../admin/', '/./guides/', '/guides/%2e%2e/admin/', '/bad%ZZ/',
    '', null, undefined,
  ];
  for (const url of unsafeUrls) {
    assert.throws(() => renderNewsArchive([article(1, 'guides', { url })]), TypeError, String(url));
  }
  const safeUrl = '/guides/%E5%8E%9F%E6%96%87/?a=1&b=2#details';
  assert.equal(articleLinks(renderNewsArchive([article(1, 'guides', { url: safeUrl })]))[0].url, safeUrl);
});

test('empty archive still has the accessible all filter, count, container and empty ItemList', () => {
  const html = renderNewsArchive([]);
  assert.match(html, /data-news-filter="all" class="is-active" aria-current="true"/);
  assert.match(html, /共 0 篇文章/);
  assert.match(html, /<div class="news-category-list"><\/div>/);
  assert.equal(categorySections(html).length, 0);
  assert.deepEqual(assertMatchingSchema(html).itemListElement, []);
});

test('rendering is pure, repeatable and does not sort or mutate the caller data', () => {
  const fixtures = [article(1, 'guides'), article(2, 'aeis'), article(3, 'guides')];
  const before = JSON.stringify(fixtures);
  fixtures.forEach(item => { Object.freeze(item.meta); Object.freeze(item); });
  Object.freeze(fixtures);
  const first = renderNewsArchive(fixtures);
  assert.equal(renderNewsArchive(fixtures), first);
  assert.equal(JSON.stringify(fixtures), before);
  assertMatchingSchema(first);
});

test('missing article metadata or category is rejected rather than guessing a topic', () => {
  assert.throws(() => renderNewsArchive(null), TypeError);
  assert.throws(() => renderNewsArchive([null]), TypeError);
  assert.throws(() => renderNewsArchive([{ url: '/guides/a/' }]), TypeError);
  for (const category of ['', '   ', null, undefined]) {
    assert.throws(() => renderNewsArchive([article(1, 'guides', { meta: { category } })]), TypeError);
  }
});
