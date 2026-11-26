import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertNoPublicBackups, findPublicBackups } from '../scripts/public-content-safety.mjs';

const root = path.resolve(import.meta.dirname, '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-public-backup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('public tree without historical backup passes without writing files', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'index.html'), '<main>Public content</main>');
  assert.deepEqual(findPublicBackups(dir), []);
  assert.equal(assertNoPublicBackups(dir), true);
  assert.deepEqual(fs.readdirSync(dir), ['index.html']);
});

test('old policy backup is rejected, not silently deleted or republished', t => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, 'aeis_backup'));
  const file = path.join(dir, 'aeis_backup', 'index.html');
  fs.writeFileSync(file, '<p>Obsolete policy</p>');
  assert.deepEqual(findPublicBackups(dir), ['aeis_backup']);
  assert.throws(() => assertNoPublicBackups(dir), /\/aeis_backup\/.*outside|outside.*\/aeis_backup\//);
  assert.equal(fs.readFileSync(file, 'utf8'), '<p>Obsolete policy</p>');
});

test('backup entry is rejected even if it is a file or dangling symlink', t => {
  const dir = fixture(t);
  const entry = path.join(dir, 'aeis_backup');
  fs.writeFileSync(entry, 'backup');
  assert.throws(() => assertNoPublicBackups(dir), /Archived content/);
  fs.unlinkSync(entry);
  fs.symlinkSync(path.join(dir, 'missing-private-archive'), entry);
  assert.throws(() => assertNoPublicBackups(dir), /Archived content/);
});

test('private archive outside the site and legitimate verification files are untouched', t => {
  const base = fixture(t);
  const site = path.join(base, 'site');
  const archive = path.join(base, 'archive');
  fs.mkdirSync(site);
  fs.mkdirSync(archive);
  fs.writeFileSync(path.join(archive, 'aeis-before-cleanup.html'), 'Archive');
  for (const name of ['googlec871b41fdb15d90a.html', 'verification.html']) fs.writeFileSync(path.join(site, name), 'Verification');
  assert.equal(assertNoPublicBackups(site), true);
  assert.equal(fs.readFileSync(path.join(archive, 'aeis-before-cleanup.html'), 'utf8'), 'Archive');
  assert.equal(fs.readdirSync(site).length, 2);
});

test('build rejects the backup before reading templates or generating any content', t => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, 'aeis_backup'));
  fs.writeFileSync(path.join(dir, 'aeis_backup', 'index.html'), 'Old content');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-content.mjs')], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Archived content.*\/aeis_backup\//);
  assert.doesNotMatch(result.stderr, /Cannot find template|ENOENT.*index\.html/);
  assert.deepEqual(fs.readdirSync(dir), ['aeis_backup']);
});

test('repository has no public historical backup and retains verification files', () => {
  assert.equal(assertNoPublicBackups(root), true);
  assert.equal(fs.existsSync(path.join(root, 'aeis_backup')), false);
  for (const name of ['googlec871b41fdb15d90a.html', 'verification.html']) assert.equal(fs.existsSync(path.join(root, name)), true);
});
