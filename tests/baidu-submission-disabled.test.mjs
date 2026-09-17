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
