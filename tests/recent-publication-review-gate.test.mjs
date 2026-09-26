import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionArticles } from '../scripts/content-validation.mjs';

function article(meta = {}, body = '[MOE](https://www.moe.gov.sg/)', url = '/o-level/test/') {
  return { meta: { draft: false, date: '2026-09-26', ...meta }, body, url };
}

test('recent educational publications require sources and review evidence', () => {
  assert.throws(
    () => partitionArticles([article({}, '没有外部来源')]),
    /Recent publication lacks external sources/
  );
  assert.throws(
    () => partitionArticles([article()]),
    /Recent publication lacks review evidence/
  );
  assert.doesNotThrow(() => partitionArticles([
    article({ reviewStatus: 'approved', reviewedBy: '编辑', factCheckedAt: '2026-09-26' }),
  ]));
});

test('legacy publications remain stable while audited incrementally', () => {
  assert.doesNotThrow(() => partitionArticles([
    article({ date: '2026-09-23' }, '历史页面待逐步补来源', '/o-level/legacy/'),
  ]));
});
