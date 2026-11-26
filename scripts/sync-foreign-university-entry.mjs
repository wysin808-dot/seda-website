import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FOREIGN_ENTRY_START = '<!-- SEDA_FOREIGN_UNIVERSITY_ENTRY_START -->';
export const FOREIGN_ENTRY_END = '<!-- SEDA_FOREIGN_UNIVERSITY_ENTRY_END -->';
const anchor = '<section class="usec" style="padding-top:0"><h2>按专业方向浏览</h2>';
export const FOREIGN_ENTRY_BLOCK = `${FOREIGN_ENTRY_START}
  <section class="usec">
    <p class="lead">本页聚焦新加坡本地公立大学与艺术大学；如需比较海外大学在新加坡的校区，可查看 <a href="/foreign-university/">海外名校新加坡校区栏目</a>。该栏目涉及商科本科、MBA / EMBA、工程硕士等不同层级项目，请按各校详情区分申请对象，不要与本页公立大学本科录取分混用。</p>
  </section>
  ${FOREIGN_ENTRY_END}`;
const requiredPages = [
  'university/index.html',
  'foreign-university/index.html',
  ...['insead', 'essec', 'chicago-booth', 'sp-jain', 'tum-asia'].map(slug => `foreign-university/${slug}/index.html`),
];

/** Insert or refresh only the marked body range; preserve all other source bytes. */
export function addForeignUniversityEntry(html) {
  const starts = html.split(FOREIGN_ENTRY_START).length - 1;
  const ends = html.split(FOREIGN_ENTRY_END).length - 1;
  if (starts > 1 || ends > 1 || starts !== ends) {
    throw new Error('Foreign university entry markers must form one unique pair');
  }
  const mainStart = html.search(/<main\b/);
  const mainEnd = html.indexOf('</main>', mainStart);
  const anchorIndex = html.indexOf(anchor);
  if (mainStart === -1 || mainEnd === -1 || anchorIndex <= mainStart || anchorIndex >= mainEnd
      || html.indexOf(anchor, anchorIndex + anchor.length) !== -1) {
    throw new Error('Missing or ambiguous university body entry anchor: 按专业方向浏览');
  }
  if (starts === 1) {
    const start = html.indexOf(FOREIGN_ENTRY_START);
    const end = html.indexOf(FOREIGN_ENTRY_END);
    if (start <= mainStart || end <= start || end + FOREIGN_ENTRY_END.length > anchorIndex) {
      throw new Error('Foreign university entry markers must be ordered inside the university body before its anchor');
    }
    return html.slice(0, start) + FOREIGN_ENTRY_BLOCK + html.slice(end + FOREIGN_ENTRY_END.length);
  }
  return html.slice(0, anchorIndex) + FOREIGN_ENTRY_BLOCK + '\n\n  ' + html.slice(anchorIndex);
}

export function syncForeignUniversityEntry(root = process.cwd()) {
  // Validate every intended destination before making the single allowed write.
  for (const relative of requiredPages) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Missing foreign university entry page: ${relative}`);
    }
  }
  const file = path.join(root, 'university/index.html');
  const html = fs.readFileSync(file, 'utf8');
  const next = addForeignUniversityEntry(html);
  if (next !== html) fs.writeFileSync(file, next, 'utf8');
  return { checked: requiredPages.length, updated: Number(next !== html) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(syncForeignUniversityEntry()));
}
