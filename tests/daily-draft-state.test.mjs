import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('generated research briefs remain explicitly blocked without faking review', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-daily-draft-'));
  try {
    const script = fileURLToPath(new URL('../scripts/generate-daily-drafts.mjs', import.meta.url));
    execFileSync(process.execPath, [script, '--count=1'], { cwd: root, stdio: 'pipe' });
    const directory = path.join(root, 'content', 'articles');
    const files = fs.readdirSync(directory).filter(file => file.endsWith('.md'));
    assert.equal(files.length, 1);
    const raw = fs.readFileSync(path.join(directory, files[0]), 'utf8');
    assert.match(raw, /^draft: true$/m);
    assert.match(raw, /^contentType: research-brief$/m);
    assert.match(raw, /^reviewStatus: needs_revision$/m);
    assert.match(raw, /^factCheckRequired: true$/m);
    assert.match(raw, /^reviewNote: .*不得发布/m);
    assert.doesNotMatch(raw, /^(?:publishedAt|reviewedBy|factCheckedAt):/m);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
