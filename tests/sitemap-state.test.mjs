import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('sitemap freshness state is versioned for reproducible lastmod values', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.ok(!ignore.split(/\r?\n/).includes('data/seo/page-updates.json'));
  const state = JSON.parse(fs.readFileSync(path.join(root, 'data/seo/page-updates.json'), 'utf8'));
  assert.ok(Object.keys(state).length > 0);
  assert.match(state['https://sgeda.org.cn/']?.lastmod || '', /^\d{4}-\d{2}-\d{2}$/);
});
