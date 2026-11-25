import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseSitemap } from '../scripts/seo-pages.mjs';
import { isFullAcceptance } from '../scripts/baidu-queue.mjs';

const root = path.resolve(import.meta.dirname, '..');
const entries = parseSitemap(fs.readFileSync(path.join(root, 'baidu-sitemap.xml'), 'utf8'));

function runPush(state, env = {}, responses = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-push-test-'));
  try {
    const stateFile = path.join(dir, 'state.json');
    const mock = path.join(dir, 'fetch.mjs');
    fs.writeFileSync(stateFile, JSON.stringify(state));
    // All requests are intercepted; these tests cannot use real Baidu quota.
    fs.writeFileSync(mock, `const replies = ${JSON.stringify(responses)}; globalThis.fetch = async () => {
      if (!replies.length) throw new Error('Unexpected request');
      return { status: 200, text: async () => JSON.stringify(replies.shift()) };
    };`);
    const result = spawnSync(process.execPath, ['--import', mock, 'scripts/baidu-push.mjs'], {
      cwd: root, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, BAIDU_TOKEN: 'test-only', BAIDU_SITE: 'sgeda.org.cn',
        BAIDU_PUSH_STATE: stateFile, REFRESH_PER_RUN: '0', DRY_RUN: '0', VERIFY: '0', PUSH_MAX: '100', PUSH_CHUNK: '50', ...env },
    });
    assert.ifError(result.error);
    return { ...result, state: JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('explicit zero disables old URL rotation', () => {
  const state = { pushed: Object.fromEntries(entries.map(e => [e.url, '2099-01-01T00:00:00Z'])) };
  const result = runPush(state, { DRY_RUN: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Updated: 0 \| Rotating refresh: 0 \| Pre-verify batch: 0/);
  assert.deepEqual(result.state, state);
});

test('updated sitemap dates enter the batch even with rotation disabled', () => {
  const state = { pushed: Object.fromEntries(entries.map(e => [e.url, '2099-01-01T00:00:00Z'])),
    lastmod: { [entries[0].url]: '2000-01-01' } };
  const result = runPush(state, { DRY_RUN: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Updated: 1 \| Rotating refresh: 0 \| Pre-verify batch: 1/);
});

test('partial acceptance preserves confirmed probe but not ambiguous batch URLs', () => {
  const result = runPush({ pushed: {} }, { PUSH_MAX: '3' }, [{ success: 1, remain: 10 }, { success: 1, remain: 9 }]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /partial or invalid acceptance/);
  assert.equal(Object.keys(result.state.pushed).length, 1);
  assert.equal(result.state.runs.at(-1).incomplete, true);
});

test('zero remaining quota stops after the confirmed probe', () => {
  const result = runPush({ pushed: {} }, { PUSH_MAX: '3' }, [{ success: 1, remain: 0 }]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(Object.keys(result.state.pushed).length, 1);
  assert.equal(result.state.runs.at(-1).quotaHit, true);
  assert.equal(result.state.runs.at(-1).incomplete, false);
});

test('over quota does not record any URL as accepted', () => {
  const result = runPush({ pushed: {} }, {}, [{ error: 400, message: 'over quota' }]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.state.pushed, {});
  assert.equal(result.state.runs.at(-1).quotaHit, true);
});

test('acceptance requires exact counts and no rejected URLs', () => {
  assert.equal(isFullAcceptance({ success: 2 }, 2), true);
  assert.equal(isFullAcceptance({ success: 1 }, 2), false);
  assert.equal(isFullAcceptance({ success: 2, not_valid: ['bad'] }, 2), false);
  assert.equal(isFullAcceptance({ success: 2, not_same_site: ['other'] }, 2), false);
  assert.equal(isFullAcceptance({ success: 2, error: 400 }, 2), false);
});
