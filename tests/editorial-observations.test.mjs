import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialIssues, researchBrief, sourceLinks } from '../scripts/editorial-policy.mjs';
import { validateObservation, observationSummary } from '../scripts/search-observations.mjs';
import { optimizeArticle } from '../scripts/seo-optimizer.mjs';
import { partitionArticles } from '../scripts/content-validation.mjs';

test('research briefs cannot become published content', () => {
  const body = researchBrief('住宿怎么选');
  assert.ok(editorialIssues({}, body).length);
  assert.throws(() => partitionArticles([{ meta: { draft: false, contentType: 'research-brief' }, body, url: '/guides/test/' }]));
});
test('long copy and FAQ do not substitute for sources or review', () => {
  const result = optimizeArticle({ meta: { title: '新加坡住宿', description: '选择住所', draft: true }, body: '套话'.repeat(2000) });
  assert.equal(result.recommendedPublish, false);
  assert.equal(result.issues.some(issue => /1500|5-8/.test(issue.message)), false);
  assert.equal(sourceLinks('[官网](https://www.moe.gov.sg/) ![图](https://images.test/x.jpg)').length, 1);
});
test('unknown search data and unavailable AI answers are not zero-index assertions', () => {
  const record = validateObservation({ type: 'search', date: '2026-09-23', platform: 'Baidu', periodStart: '2026-09-22', periodEnd: '2026-09-22', evidence: 'manual export', clicks: 0 });
  assert.equal(record.indexed, null);
  assert.equal(record.clicks, 0);
  assert.equal(observationSummary('/nonexistent-seda-observations.jsonl').status, 'unmeasured');
});
test('AI citation records require a matching actual site URL and evidence', () => {
  const base = { type: 'citation', date: '2026-09-23', platform: 'ChatGPT', question: 'AEIS 年龄要求', model: 'observed model', webEnabled: true, evidence: 'screenshot reference', result: 'cited' };
  assert.throws(() => validateObservation(base));
  assert.throws(() => validateObservation({ ...base, citedUrls: ['https://sgeda.org.cn.evil.test/'] }));
  assert.equal(validateObservation({ ...base, citedUrls: ['https://sgeda.org.cn/aeis/'] }).result, 'cited');
  assert.throws(() => validateObservation({ ...base, date: '2026-02-30' }));
});
