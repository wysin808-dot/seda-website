import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('daily SEO audit cannot post URLs to Baidu', () => {
  const bot = fs.readFileSync(path.join(root, 'scripts', 'seo-daily-bot.mjs'), 'utf8');
  assert.match(bot, /Automatic Baidu URL submission is disabled/);
  assert.doesNotMatch(bot, /data\.zz\.baidu\.com\/urls/);
  assert.doesNotMatch(bot, /recordAccepted\(/);
});

test('legacy submission entry points cannot consume Baidu quota', () => {
  const compatibilityScript = fs.readFileSync(path.join(root, 'scripts', 'baidu-submit.sh'), 'utf8');
  const cronInstaller = fs.readFileSync(path.join(root, 'scripts', 'install-seo-submit-cron.sh'), 'utf8');
  assert.match(compatibilityScript, /Automatic Baidu URL submission is disabled/);
  assert.doesNotMatch(compatibilityScript, /data\.zz\.baidu\.com|BAIDU_TOKEN|curl\s+-.*POST/);
  assert.match(cronInstaller, /rm -f/);
  assert.doesNotMatch(cronInstaller, /npm run seo:submit/);
});
