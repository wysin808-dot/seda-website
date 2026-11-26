import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import {
  addForeignUniversityEntry,
  syncForeignUniversityEntry,
  FOREIGN_ENTRY_BLOCK,
  FOREIGN_ENTRY_START,
  FOREIGN_ENTRY_END,
} from '../scripts/sync-foreign-university-entry.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const slugs = ['insead', 'essec', 'chicago-booth', 'sp-jain', 'tum-asia'];
const routes = ['/', '/university/', '/foreign-university/', ...slugs.map(slug => `/foreign-university/${slug}/`)];
const fileFor = route => route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
const anchor = '<section class="usec" style="padding-top:0"><h2>按专业方向浏览</h2>';
const university = () => read('university/index.html');
const withoutEntry = html => html.replace(FOREIGN_ENTRY_BLOCK + '\n\n  ', '');
const rawShared = html => ['header', 'footer'].map(tag => html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`))?.[0]);

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-foreign-entry-'));
  for (const route of routes) {
    const relative = fileFor(route);
    const destination = path.join(directory, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, route === '/university/' ? withoutEntry(university()) : read(relative));
  }
  return directory;
}

function staticLinks(html, route) {
  const $ = load(html);
  return $('a[href]').toArray().flatMap(element => {
    const href = $(element).attr('href');
    if (!href || /^(?:javascript|mailto|tel):/i.test(href)) return [];
    const url = new URL(href, `https://sgeda.org.cn${route}`);
    return url.origin === 'https://sgeda.org.cn' ? [url.pathname] : [];
  });
}

test('actual university body has one clear, ordinary static foreign-column entry', () => {
  const html = university();
  const $ = load(html);
  assert.equal(html.split(FOREIGN_ENTRY_START).length - 1, 1);
  assert.equal(html.split(FOREIGN_ENTRY_END).length - 1, 1);
  assert.equal($('a[href="/foreign-university/"]').length, 1);
  const entry = $('main section a[href="/foreign-university/"]');
  assert.equal(entry.length, 1);
  assert.equal(entry.text(), '海外名校新加坡校区栏目');
  assert.equal(entry.closest('header, footer, nav, script, template, [hidden], [aria-hidden="true"]').length, 0);
  for (const attribute of ['onclick', 'hidden', 'rel']) assert.equal(entry.attr(attribute), undefined);
  const paragraph = entry.closest('p').text();
  assert.match(paragraph, /本页聚焦新加坡本地公立大学与艺术大学/);
  assert.match(paragraph, /商科本科、MBA \/ EMBA、工程硕士/);
  assert.match(paragraph, /按各校详情区分申请对象/);
  assert.match(paragraph, /不要与本页公立大学本科录取分混用/);
  assert.equal(entry.closest('section').find('a').length, 1);
  assert.doesNotMatch(FOREIGN_ENTRY_BLOCK, /<script|<style|style=|高考直录|排名|全部学校/i);
});

test('actual eight-page static link graph reaches the foreign hub and five details from home', () => {
  const graph = new Map(routes.map(route => {
    assert.ok(fs.statSync(path.join(root, fileFor(route))).isFile(), route);
    return [route, staticLinks(read(fileFor(route)), route).filter(target => routes.includes(target))];
  }));
  assert.ok(graph.get('/').includes('/university/'));
  assert.ok(graph.get('/university/').includes('/foreign-university/'));
  for (const slug of slugs) {
    const detail = `/foreign-university/${slug}/`;
    assert.ok(graph.get('/foreign-university/').includes(detail), detail);
    assert.ok(!graph.get('/').includes(detail), `Do not add ${detail} to home`);
    assert.ok(!graph.get('/university/').includes(detail), `Use the column, not five direct ${detail} links`);
  }
  const parents = new Map([['/', null]]);
  const queue = ['/'];
  for (let index = 0; index < queue.length; index++) {
    for (const destination of graph.get(queue[index]) || []) {
      if (parents.has(destination)) continue;
      parents.set(destination, queue[index]);
      queue.push(destination);
    }
  }
  const foreignRoutes = routes.filter(route => route.startsWith('/foreign-university/'));
  assert.equal(foreignRoutes.filter(route => parents.has(route)).length, 6);
  assert.equal(parents.get('/foreign-university/'), '/university/');
  for (const slug of slugs) assert.equal(parents.get(`/foreign-university/${slug}/`), '/foreign-university/');
});

test('real pure transformation is byte-local and leaves shared header/footer unchanged', () => {
  const current = university();
  const before = withoutEntry(current);
  assert.notEqual(before, current);
  assert.equal(addForeignUniversityEntry(before), current);
  assert.equal(addForeignUniversityEntry(current), current);
  assert.deepEqual(rawShared(current), rawShared(before));
  assert.ok(rawShared(current).every(Boolean));
  assert.equal(withoutEntry(addForeignUniversityEntry(before)), before);
});

test('real file synchronizer updates only the university body and a second run writes nothing', () => {
  const directory = fixture();
  try {
    const snapshots = new Map(routes.map(route => {
      const relative = fileFor(route);
      return [relative, fs.readFileSync(path.join(directory, relative), 'utf8')];
    }));
    assert.deepEqual(syncForeignUniversityEntry(directory), { checked: 7, updated: 1 });
    const target = path.join(directory, 'university/index.html');
    const first = fs.readFileSync(target, 'utf8');
    assert.equal(first, addForeignUniversityEntry(snapshots.get('university/index.html')));
    assert.deepEqual(rawShared(first), rawShared(snapshots.get('university/index.html')));
    const modified = fs.statSync(target).mtimeNs ?? fs.statSync(target).mtimeMs;
    assert.deepEqual(syncForeignUniversityEntry(directory), { checked: 7, updated: 0 });
    assert.equal(fs.readFileSync(target, 'utf8'), first);
    assert.equal(fs.statSync(target).mtimeNs ?? fs.statSync(target).mtimeMs, modified);
    for (const [relative, original] of snapshots) {
      if (relative !== 'university/index.html') assert.equal(fs.readFileSync(path.join(directory, relative), 'utf8'), original, relative);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('stale marked copy is refreshed once without replacing any surrounding bytes', () => {
  const current = university();
  const stale = current.replace('海外名校新加坡校区栏目</a>', '旧入口</a>');
  const next = addForeignUniversityEntry(stale);
  assert.equal(next, current);
  assert.equal(addForeignUniversityEntry(next), next);
});

test('duplicate, incomplete, reversed or misplaced markers fail explicitly', () => {
  const current = university();
  for (const html of [
    current + FOREIGN_ENTRY_START,
    current + FOREIGN_ENTRY_END,
    current.replace(FOREIGN_ENTRY_END, ''),
    current.replace(FOREIGN_ENTRY_START, ''),
    FOREIGN_ENTRY_BLOCK + withoutEntry(current),
    withoutEntry(current) + FOREIGN_ENTRY_BLOCK,
  ]) assert.throws(() => addForeignUniversityEntry(html), /markers/i);
  const reversed = withoutEntry(current).replace(anchor, FOREIGN_ENTRY_END + FOREIGN_ENTRY_START + anchor);
  assert.throws(() => addForeignUniversityEntry(reversed), /markers/i);
});

test('missing university or any of the six foreign target pages fails before a write', () => {
  for (const relative of routes.filter(route => route !== '/').map(fileFor)) {
    const directory = fixture();
    try {
      const target = path.join(directory, 'university/index.html');
      const before = fs.readFileSync(target, 'utf8');
      fs.rmSync(path.join(directory, relative));
      assert.throws(() => syncForeignUniversityEntry(directory), error => error.message.includes('Missing foreign university entry page: ' + relative));
      if (relative !== 'university/index.html') assert.equal(fs.readFileSync(target, 'utf8'), before);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
});

test('missing or ambiguous body anchor fails instead of silently losing or misplacing the entry', () => {
  const current = withoutEntry(university());
  for (const html of [
    current.replace(anchor, ''),
    current.replace(anchor, anchor + anchor),
    current.replace('<main>', '<div>').replace('</main>', '</div>'),
    current.replace('</main>', ''),
  ]) assert.throws(() => addForeignUniversityEntry(html), /anchor/i);
});

test('actual legacy university template can regain the entry without running its whole-page generator', () => {
  const generator = read('scripts/build-uni-db.py');
  assert.match(generator, /open\(os\.path\.join\(ROOT,"university\/index\.html"\),"w"/);
  const body = [...generator.matchAll(/    body=f'''([\s\S]*?)\n'''/g)].find(match => match[1].includes(anchor));
  assert.ok(body, 'Expected actual legacy landing body template');
  assert.ok(body[1].includes(anchor));
  const template = `<main><div class="ud-page">${body[1]}</div></main>`;
  const restored = addForeignUniversityEntry(template);
  assert.equal(restored.split(FOREIGN_ENTRY_START).length - 1, 1);
  assert.equal(addForeignUniversityEntry(restored), restored);
  assert.equal(withoutEntry(restored), template);
  assert.equal(load(restored)('main a[href="/foreign-university/"]').length, 1);
});

test('current build imports and calls the real synchronizer once after generators and before sitemap', () => {
  const build = read('scripts/build-content.mjs');
  assert.match(build, /import \{ syncForeignUniversityEntry \} from '\.\/sync-foreign-university-entry\.mjs';/);
  assert.equal([...build.matchAll(/syncForeignUniversityEntry\(root\);/g)].length, 1);
  const hook = build.indexOf('syncForeignUniversityEntry(root);');
  assert.ok(hook > build.indexOf('const migrationStats ='));
  assert.ok(hook > build.indexOf('articles.filter(a =>'));
  assert.ok(hook < build.indexOf('const urlCount = updateSitemap(drafts);'));
});
