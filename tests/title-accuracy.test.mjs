import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';

const cases = [
  ['../index.html', 'SEDA 新加坡择校网 - 新加坡留学与升学指南'],
  ['../wace/index.html', '新加坡 WACE 课程：ATAR与大学申请 - SEDA 新加坡择校网'],
];

for (const [file, title] of cases) {
  test(`${file}: accurate search title and unique search metadata`, () => {
    const $ = load(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
    assert.equal($('head > title').length, 1);
    assert.equal($('head > title').text(), title);
    assert.equal($('meta[name="description"]').length, 1);
    assert.equal($('link[rel="canonical"]').length, 1);
  });
}

test('WACE separates application thresholds from admission promises', () => {
  const $ = load(fs.readFileSync(new URL('../wace/index.html', import.meta.url), 'utf8'));
  assert.doesNotMatch($('h1, h2, h3').text(), /ATAR\s*90\s*起步冲刺国大与南大/);
  assert.match($('main').text(), /南大国际生为 95/);
  assert.match($('main').text(), /达到最低条件不代表获得录取/);
});
