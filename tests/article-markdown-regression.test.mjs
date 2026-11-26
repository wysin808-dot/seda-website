import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build = fs.readFileSync(new URL('../scripts/build-content.mjs', import.meta.url), 'utf8');
const functionText = build.match(/function stripInlineMarkdown\(value = ''\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionText, 'Locate the real FAQ plain-text conversion');
const context = vm.createContext({});
vm.runInContext(functionText, context);

test('article FAQ generation preserves numeric ranges and hyphenated exam names', () => {
  assert.equal(context.stripInlineMarkdown('每天 **10-20** 道练习，持续 20-30 分钟；S-AEIS 与 AEIS。'), '每天 10-20 道练习，持续 20-30 分钟；S-AEIS 与 AEIS。');
});

test('article FAQ conversion removes real markdown markers without corrupting links', () => {
  assert.equal(context.stripInlineMarkdown('- 阅读 [MOE 资格](https://www.moe.gov.sg/international-students/aeis/eligibility-criteria) 与 `CEQ`。'), '阅读 MOE 资格 与 CEQ。');
});
