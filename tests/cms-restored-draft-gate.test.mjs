import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { markSourceFreeDraftsForReview } from '../scripts/mark-source-free-drafts-for-review.mjs';

test('restored source-free CMS drafts are marked for revision before validation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-restored-draft-'));
  try {
    const articleDir = path.join(root, 'content', 'articles');
    fs.mkdirSync(articleDir, { recursive: true });
    const articlePath = path.join(articleDir, 'wace-cms-restored.md');
    fs.writeFileSync(articlePath, `---
title: CMS 恢复草稿
draft: true
reviewStatus: pending
---

未经来源核验的草稿。\n`, 'utf8');
    const result = markSourceFreeDraftsForReview({ root, reviewDate: '2026-09-24' });
    assert.deepEqual(result.updated, ['wace-cms-restored.md']);
    const updated = fs.readFileSync(articlePath, 'utf8');
    assert.match(updated, /^contentType: research-brief$/m);
    assert.match(updated, /^reviewStatus: needs_revision$/m);
    assert.match(updated, /^factCheckRequired: true$/m);
    assert.match(updated, /^reviewedAt: 2026-09-24$/m);
    assert.match(updated, /不得发布/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
