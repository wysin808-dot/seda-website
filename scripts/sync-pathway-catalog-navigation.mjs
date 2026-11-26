import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'cheerio';

const excluded = new Set(['node_modules', 'content', 'data', 'scripts', 'tests', 'docs', 'reports', 'cms', 'review', 'content-review']);
function* htmlFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('_backup') || excluded.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield file;
  }
}

/** Change only shared-menu source ranges, never page bodies or policy links. */
export function distinguishPathwayCatalogNavigation(html) {
  if (html.includes('<!-- SEDA_SCHOOL_REDIRECT -->')) return html;
  const $ = load(html, { sourceCodeLocationInfo: true });
  const edits = [];
  $('header.site-header .main-nav .nav-group').each((_, group) => {
    const label = $(group).children('.nav-label').clone();
    label.find('svg').remove();
    const name = label.text().trim();
    const dropdown = $(group).children('.mega-dropdown').first();
    if (!dropdown.length) return;
    if (name === '学校库') {
      const targets = new Map([['/jc/', '/school-database/jc/'], ['/international-school/', '/international-school/schools/']]);
      dropdown.find('a[href]').each((_, anchor) => {
        const target = targets.get($(anchor).attr('href'));
        if (!target) return;
        const loc = anchor.sourceCodeLocation?.attrs?.href;
        if (!loc) throw new Error('学校库菜单链接缺少原始位置');
        edits.push({ start: loc.startOffset, end: loc.endOffset, value: `href="${target}"` });
      });
    } else if (name === '升学路径' && !dropdown.find('a[href="/pathway/"]').length) {
      const loc = dropdown[0].sourceCodeLocation?.startTag;
      if (!loc) throw new Error('升学路径菜单缺少原始位置');
      edits.push({ start: loc.endOffset, end: loc.endOffset, value: '<a href="/pathway/">升学路径总览</a>' });
    }
  });
  let next = html;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.value + next.slice(edit.end);
  }
  return next;
}

export function syncPathwayCatalogNavigation(root = process.cwd()) {
  const changes = [];
  let checked = 0;
  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(file, 'utf8');
    const next = distinguishPathwayCatalogNavigation(html);
    checked++;
    if (next !== html) changes.push({ file, next });
  }
  for (const { file, next } of changes) fs.writeFileSync(file, next);
  return { checked, updated: changes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(syncPathwayCatalogNavigation()));
}
