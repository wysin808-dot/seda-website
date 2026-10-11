import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'cheerio';

const excludedDirectories = new Set(['node_modules', '.git', 'content', 'data', 'scripts', 'tests', 'cms', 'review']);

function* htmlFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('_backup') || excludedDirectories.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield file;
  }
}

function stylesheetNodes($) {
  return $('link[rel="stylesheet"]').toArray().filter(node => /^\/seda-site\.css(?:\?|$)/.test($(node).attr('href') || ''));
}

export function syncSiteFooter(root = process.cwd()) {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const $home = load(home, { sourceCodeLocationInfo: true });
  const footer = $home('footer.site-footer');
  if (footer.length !== 1) throw new Error('Homepage must have exactly one shared footer');
  const location = footer[0].sourceCodeLocation;
  const markup = home.slice(location.startOffset, location.endOffset);
  const styles = stylesheetNodes($home);
  if (styles.length !== 1) throw new Error('Homepage must have exactly one shared stylesheet');
  const stylesheet = $home(styles[0]).attr('href');
  const changes = [];
  let checked = 0;

  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(file, 'utf8');
    const $ = load(html, { sourceCodeLocationInfo: true });
    const footers = $('footer.site-footer');
    if (!footers.length) continue;
    if (footers.length !== 1) throw new Error(`Multiple shared footers: ${file}`);
    checked++;
    const loc = footers[0].sourceCodeLocation;
    const edits = [{ start: loc.startOffset, end: loc.endOffset, value: markup }];
    for (const node of stylesheetNodes($)) {
      const attr = node.sourceCodeLocation.attrs.href;
      edits.push({ start: attr.startOffset, end: attr.endOffset, value: `href="${stylesheet}"` });
    }
    // Replace only source ranges, preserving each page's independent markup.
    let next = html;
    for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.value + next.slice(edit.end);
    if (next !== html) changes.push({ file, next });
  }

  for (const { file, next } of changes) fs.writeFileSync(file, next);
  return { checked, updated: changes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(syncSiteFooter()));
}
