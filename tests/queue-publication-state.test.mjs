import test from 'node:test';
import assert from 'node:assert/strict';
import { missingPublishedQueueRoutes, publishedQueueRoutes } from '../scripts/queue-publications.mjs';

test('published queue routes are parsed without treating drafts as public', () => {
  const csv = [
    'keyword,category,priority,status,notes',
    '已发布文章,wace,high,done,已发布 /wace/published/',
    '草稿文章,wace,high,draft,待补来源；未发布',
    '已发布文章二,aeis,medium,published,已发布 /aeis/published-two/',
  ].join('\n');
  assert.deepEqual(publishedQueueRoutes(csv), [
    { route: '/wace/published/', keyword: '已发布文章', line: 2 },
    { route: '/aeis/published-two/', keyword: '已发布文章二', line: 4 },
  ]);
});

test('published queue routes require publication notes', () => {
  const csv = [
    'keyword,category,priority,status,notes',
    '未确认文章,wace,high,done,待人工确认',
  ].join('\n');
  assert.deepEqual(publishedQueueRoutes(csv), []);
});

test('published queue routes must exist in the generated sitemap', () => {
  const csv = [
    'keyword,category,priority,status,notes',
    '公开文章,wace,high,done,已发布 /wace/published/',
    '失效文章,aeis,high,done,已发布 /aeis/missing/',
  ].join('\n');
  const sitemapUrls = new Set(['https://sgeda.org.cn/wace/published/']);
  assert.deepEqual(missingPublishedQueueRoutes(csv, sitemapUrls, 'https://sgeda.org.cn'), [
    { route: '/aeis/missing/', keyword: '失效文章', line: 3 },
  ]);
});
