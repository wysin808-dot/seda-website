import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function mergeContent(base, server, incoming) {
  if (server === base || server === incoming) return incoming;
  if (incoming === base) return server;
  if (base === null || incoming === null || server === null) throw new Error('Concurrent file creation or deletion');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-content-merge-'));
  try {
    const files = ['server', 'base', 'incoming'].map(name => path.join(dir, name));
    [server, base, incoming].forEach((data, i) => fs.writeFileSync(files[i], data));
    const result = spawnSync('git', ['merge-file', '--stdout', ...files], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('CMS and GitHub changed the same content; backup preserved');
    return result.stdout;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [backup, previous] = process.argv.slice(2);
  if (!backup || !previous) throw new Error('Usage: restore-cms-content.mjs BACKUP PREVIOUS_COMMIT');
  const dir = path.join(backup, 'content/articles');
  const paths = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => `content/articles/${f}`) : [];
  if (fs.existsSync(path.join(backup, 'content/keyword-queue.csv'))) paths.push('content/keyword-queue.csv');
  const pending = [];
  for (const relative of paths) {
    const server = fs.readFileSync(path.join(backup, relative), 'utf8');
    const incoming = fs.existsSync(relative) ? fs.readFileSync(relative, 'utf8') : null;
    let base = null;
    try { base = execFileSync('git', ['show', `${previous}:${relative}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
    let merged;
    try { merged = mergeContent(base, server, incoming); }
    catch (e) { throw new Error(`${relative}: ${e.message}. Backup: ${backup}`); }
    if (merged !== incoming && merged !== null) pending.push({ relative, merged });
  }
  for (const { relative, merged } of pending) {
    fs.mkdirSync(path.dirname(relative), { recursive: true });
    fs.writeFileSync(relative, merged);
  }
  console.log(`Preserved ${pending.length} CMS changes; repository fixes retained.`);
}
