import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { load } from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('corrected core facts and structured data stay aligned', () => {
  const aeis = read('aeis/index.html');
  assert.match(aeis, /50 道选择题 \+ 写作/);
  assert.doesNotMatch(aeis, /34 题 \+ 作文|S\$1,285/);
  assert.match(aeis, /小学 AEIS 不设英语试卷/);
  const cost = read('guides/cost/index.html');
  assert.match(cost, /S\$26,280/);
  assert.match(cost, /S\$48,880/);
  const timeline = read('guides/timeline/index.html');
  assert.match(timeline, /2027 年 1 月 13 日/);
  assert.doesNotMatch(timeline, /父亲只能申请旅游签证|第二年起可以在新加坡兼职/);
  for (const html of [aeis, cost, timeline]) {
    const $ = load(html);
    $('script[type="application/ld+json"]').each((_, script) => assert.doesNotThrow(() => JSON.parse($(script).text())));
  }
});
test('interview correction retains stable URL without fabricated selection claims', () => {
  const article = read('content/articles/aeis-interview-preparation-chinese-students.md');
  assert.match(article, /slug: aeis-interview-preparation-chinese-students/);
  assert.match(article, /https:\/\/www.seab.gov.sg\/aeis\/release-of-school-offers\//);
  assert.doesNotMatch(article, /最后一道关卡|评分的五个维度|通常当场或同日/);
});
test('CMS inline scripts compile and no fixed daily publishing quota remains', () => {
  const html = read('cms/index.html');
  const $ = load(html);
  $('script:not([src])').each((_, script) => assert.doesNotThrow(() => new vm.Script($(script).text())));
  assert.doesNotMatch(html, /const dailyTarget = 5|正文 1500 字以上|FAQ 4 个以上/);
});
