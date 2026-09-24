import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sourceLinks } from '../scripts/editorial-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const articleDir = path.join(root, 'content', 'articles');

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index > 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { meta, body: match[2] };
}

test('source-free drafts remain blocked pending factual review', () => {
  const sourceFreeDrafts = [];
  for (const file of fs.readdirSync(articleDir).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort()) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(articleDir, file), 'utf8'));
    if (meta.draft !== 'true' || sourceLinks(body).length) continue;
    sourceFreeDrafts.push(file);
    assert.equal(meta.contentType, 'research-brief', `${file} must remain a research brief`);
    assert.equal(meta.reviewStatus, 'needs_revision', `${file} must be marked for revision`);
    assert.equal(meta.factCheckRequired, 'true', `${file} must require fact checking`);
    assert.match(meta.reviewNote || '', /不得发布/, `${file} must state that publication is blocked`);
  }
  assert.ok(sourceFreeDrafts.length > 0, 'expected at least one source-free draft to be protected');
});
