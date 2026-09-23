import test from 'node:test';
import assert from 'node:assert/strict';
import { singaporeDate, referrerSource, filterTraffic, legacyBaiduRecords, mergeSubmissionRecords, optionalCount } from '../scripts/operations-metrics.mjs';

test('Singapore reporting dates cross UTC midnight correctly', () => {
  assert.equal(singaporeDate('2026-09-22T16:00:00Z'), '2026-09-23');
  assert.equal(singaporeDate('invalid'), '');
});
test('known AI sources use domain boundaries, not substrings', () => {
  assert.equal(referrerSource('https://chatgpt.com/?x=1'), 'ChatGPT');
  assert.equal(referrerSource('https://www.baidu.com/s'), '百度');
  assert.notEqual(referrerSource('https://baidu.com.evil.test/'), '百度');
  assert.notEqual(referrerSource('https://not-sgeda.org.cn/'), '站内');
});
test('all engagement and conversion events follow the same traffic filter', () => {
  const result = filterTraffic([
    { device: '爬虫' }, { trafficClass: 'internal' }, { isTest: true },
    { device: '爬虫', eventType: 'wechat_copy' }, { path: '/aeis/', referrer: 'https://kimi.com/' },
  ]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].source, 'Kimi');
  assert.deepEqual(result.excluded, { bot: 1, internal: 1, test: 1 });
  assert.equal(result.rawPageviews, 4);
});
test('server acceptance is imported without inventing success or duplicating ledger entries', () => {
  const log = '[2026-09-23 09:10] 百度响应: {"remain":0,"success":5}\n/bin/sh: Permission denied\n[2026-09-23 09:11] 百度响应: {"error":400,"message":"over quota"}\n[2026-09-23 09:12] 百度响应: {broken}';
  const rows = legacyBaiduRecords(log);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'success');
  assert.equal(rows[0].response.remain, 0);
  assert.equal(rows[1].submitted, 0);
  assert.equal(rows[1].status, 'error');
  assert.equal(mergeSubmissionRecords([{ ...rows[0], createdAt: '2026-09-23T01:10:00Z' }], rows, '2026-09-23').length, 2);
  assert.equal(mergeSubmissionRecords([], rows, '2026-09-22').length, 0);
});
test('unknown measurements remain null; explicit zero remains zero', () => {
  assert.equal(optionalCount(''), null);
  assert.equal(optionalCount(undefined), null);
  assert.equal(optionalCount('0'), 0);
  assert.throws(() => optionalCount('-1'));
  assert.throws(() => optionalCount('NaN'));
});
