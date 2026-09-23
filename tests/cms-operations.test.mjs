import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { verifyBuiltPublication } from '../scripts/content-validation.mjs';

test('publication validation rejects missing pages and missing sitemap entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-publish-'));
  try {
    assert.throws(() => verifyBuiltPublication(root, '/test/'), /missing/);
    fs.mkdirSync(path.join(root, 'test'));
    fs.writeFileSync(path.join(root, 'test/index.html'), '<title>Test</title><meta name="description" content="Test"><link rel="canonical" href="https://sgeda.org.cn/test/"><h1>Test</h1>');
    fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset/>');
    assert.throws(() => verifyBuiltPublication(root, '/test/'), /sitemap/);
    fs.writeFileSync(path.join(root, 'sitemap.xml'), '<urlset><url><loc>https://sgeda.org.cn/test/</loc></url></urlset>');
    assert.equal(verifyBuiltPublication(root, '/test/').status, 'verified');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('CMS API filters bots/internal/tests and preserves unknown metrics', { timeout: 15000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-api-'));
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, [path.resolve(import.meta.dirname, '../server-selfhost.js')], {
    cwd: root, env: { ...process.env, PORT: String(port), CMS_ADMIN_PASSWORD: 'fixture-password', CMS_SESSION_SECRET: 'fixture-session', ANALYTICS_REPORT_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Fixture server exited'); })]);
    const call = async (route, body, headers = {}) => fetch(`http://127.0.0.1:${port}${route}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const login = await call('/api/cms/login', { username: 'admin', password: 'fixture-password' });
    assert.equal(login.status, 200);
    const auth = { cookie: login.headers.get('set-cookie').split(';')[0] };
    await call('/api/analytics/collect', { path: '/aeis/' }, { 'user-agent': 'Baiduspider' });
    await call('/api/analytics/collect', { path: '/aeis/' }, auth);
    await call('/api/analytics/collect', { path: '/aeis/', isTest: true });
    await call('/api/analytics/collect', { path: '/aeis/', referrer: 'https://chatgpt.com/' });
    const report = await (await call('/api/cms/analytics', undefined, auth)).json();
    assert.equal(report.totals.pageviewEvents, 1);
    assert.deepEqual(report.totals.excluded, { bot: 1, internal: 1, test: 1 });
    assert.equal(report.sources[0].name, 'ChatGPT');
    const saved = await (await call('/api/cms/seo', { date: '2026-09-23', searchClicks: 0, measurementSource: 'fixture only' }, auth)).json();
    assert.equal(saved.record.searchClicks, 0);
    assert.equal(saved.record.indexedCount, null);
    assert.equal(saved.record.abnormalUrlCount, null);
    assert.equal((await call('/api/cms/seo', { searchClicks: 0 }, auth)).status, 400);
    assert.equal((await call('/api/analytics/report?token=seda-report-2026')).status, 403);
  } finally {
    const stopped = once(child, 'exit'); child.kill(); await stopped;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
