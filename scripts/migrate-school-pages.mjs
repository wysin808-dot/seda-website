import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ORIGIN = 'https://sgeda.org.cn';
export const REDIRECT_MARKER = '<!-- SEDA_SCHOOL_REDIRECT -->';
export const CATEGORY_ROUTES = Object.freeze({
  primary: '/primary-schools/', secondary: '/secondary-schools/',
  international: '/international-school/schools/', private: '/private-schools/',
  jc: '/school-database/jc/', poly: '/school-database/poly/', university: '/school-database/university/',
});
const DATABASE_PAGES = new Set(['/school-database/', ...Object.values(CATEGORY_ROUTES)]);
const htmlEscape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Deliberately exclude percent escapes, query strings, Nginx variables and Unicode.
// These are policy paths, not arbitrary visitor URLs.
export function assertSafePath(value, { target = false } = {}) {
  if (typeof value !== 'string' || !/^\/[A-Za-z0-9._~/-]*(?:#[A-Za-z0-9_-]+)?$/.test(value)
      || value.includes('//') || value.split(/[\/#]/).some(part => part === '.' || part === '..')
      || (!target && value.includes('#')) || value === '/') {
    throw new Error(`Unsafe school ${target ? 'target' : 'source'}: ${JSON.stringify(value)}`);
  }
  const [pathname, fragment] = value.split('#');
  if (!pathname.endsWith('/') || (fragment !== undefined && (!target || !/^school-[A-Za-z0-9_-]+$/.test(fragment)))) {
    throw new Error(`School policy requires a slash path and a stable school fragment: ${value}`);
  }
  return value;
}

export function sourceVariants(from) {
  assertSafePath(from);
  return [from, from.slice(0, -1), `${from}index.html`];
}

export function schoolMigrationTarget(record, policy) {
  if (!record || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id || '')) throw new Error('Invalid school record ID');
  const category = CATEGORY_ROUTES[record.category === 'artsUniversity' ? 'university' : record.category];
  if (!category) throw new Error(`Unknown school category: ${record.category}`);
  if (record.detailUrl) {
    assertSafePath(record.detailUrl);
    if (!policy.retainedDetails.includes(record.detailUrl)) throw new Error(`Unretained school detail: ${record.detailUrl}`);
    return record.detailUrl;
  }
  return `${category}#school-${record.id}`;
}

export function prepareSchoolMigration(policy, catalog) {
  if (policy?.version !== 1 || !Array.isArray(policy.categories) || !Array.isArray(policy.retainedDetails)
      || !Array.isArray(policy.redirects) || !Array.isArray(catalog)) throw new Error('Invalid catalog policy contract');
  if (policy.categories.length !== 7 || new Set(policy.categories.map(category => category.id)).size !== 7) throw new Error('Expected the seven school categories');
  for (const category of policy.categories) {
    if (CATEGORY_ROUTES[category.id] !== category.route) throw new Error(`Unexpected category route: ${category.id}`);
  }
  const retained = new Set(policy.retainedDetails.map(route => assertSafePath(route)));
  const records = new Map();
  for (const record of catalog) {
    if (records.has(record.id)) throw new Error(`Duplicate record ID: ${record.id}`);
    schoolMigrationTarget(record, policy);
    records.set(record.id, record);
  }
  const redirects = [];
  const bySource = new Map();
  const exact = new Map();
  for (const entry of policy.redirects) {
    assertSafePath(entry.from);
    assertSafePath(entry.to, { target: true });
    const record = records.get(entry.recordId);
    if (!record) throw new Error(`Unknown redirect record: ${entry.recordId}`);
    const expected = schoolMigrationTarget(record, policy);
    if (entry.to !== expected) throw new Error(`Wrong school target for ${entry.from}; expected ${expected}`);
    if (!Array.isArray(record.legacyUrls) || !record.legacyUrls.includes(entry.from)) throw new Error(`Source is not this school's legacy URL: ${entry.from}`);
    if (retained.has(entry.from) || DATABASE_PAGES.has(entry.from)) throw new Error(`Protected school path: ${entry.from}`);
    if (entry.from === entry.to.split('#')[0]) throw new Error(`Self redirect: ${entry.from}`);
    if (bySource.has(entry.from)) throw new Error(`Duplicate/conflicting redirect: ${entry.from}`);
    bySource.set(entry.from, entry);
    for (const variant of sourceVariants(entry.from)) {
      if (exact.has(variant)) throw new Error(`Conflicting redirect variant: ${variant}`);
      exact.set(variant, entry.to);
    }
    redirects.push({ ...entry, record });
  }
  // No chains, even if the eventual chain would terminate; every target must be active.
  for (const entry of redirects) {
    if (bySource.has(entry.to.split('#')[0])) throw new Error(`Redirect chain/cycle: ${entry.from}`);
  }
  redirects.sort((a, b) => a.from.localeCompare(b.from, 'en'));
  return { policy, catalog, redirects, exact };
}

export function renderSchoolRedirectHtml(entry) {
  const target = `${ORIGIN}${entry.to}`;
  const canonical = `${ORIGIN}${entry.to.split('#')[0]}`;
  const name = entry.record.nameZh || entry.record.nameEn || entry.record.id;
  return `<!doctype html>\n${REDIRECT_MARKER}\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${htmlEscape(name)}｜学校资料已迁移 | SEDA</title>\n<meta name="robots" content="noindex,follow">\n<link rel="canonical" href="${htmlEscape(canonical)}">\n<!-- 非 Nginx 环境兼容：meta refresh 不是 HTTP 301；正式站点由 Nginx 精确规则返回 301。 -->\n<meta http-equiv="refresh" content="0;url=${htmlEscape(target)}">\n</head>\n<body>\n<main><h1>${htmlEscape(name)}</h1><p>学校资料已迁移，请访问<a href="${htmlEscape(target)}">${htmlEscape(name)}学校资料</a>。</p></main>\n</body>\n</html>\n`;
}

export function renderSchoolNginxRules(prepared) {
  const lines = ['# SEDA_SCHOOL_REDIRECT generated by scripts/migrate-school-pages.mjs', '# Exact legacy school URLs only. Quoted targets preserve the school fragment.'];
  for (const entry of prepared.redirects) {
    for (const variant of sourceVariants(entry.from)) lines.push(`location = ${variant} { return 301 "${ORIGIN}${entry.to}"; }`);
  }
  return `${lines.join('\n')}\n`;
}

async function loadInputs(root, options) {
  if (options.policy && options.catalog) return prepareSchoolMigration(options.policy, options.catalog);
  // Import only when called; the model is owned by the catalog agent.
  const model = await import(pathToFileURL(path.join(root, 'scripts/school-catalog.mjs')).href);
  const [policy, catalog] = await Promise.all([model.loadCatalogPolicy(root), model.loadCatalog(root)]);
  return prepareSchoolMigration(policy, catalog);
}

async function siteFile(root, route) {
  const base = path.resolve(root);
  const file = path.join(base, route.slice(1), 'index.html');
  // Reject symlink escapes, including existing parents of a newly generated file.
  let ancestor = file;
  for (;;) {
    try {
      const real = await fs.realpath(ancestor);
      const realRoot = await fs.realpath(base);
      if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) throw new Error(`School path escapes root: ${route}`);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ancestor = path.dirname(ancestor);
    }
  }
  return file;
}

export async function validateSchoolMigrationTargets(root = process.cwd(), options = {}) {
  const prepared = options.prepared || await loadInputs(root, options);
  for (const entry of prepared.redirects) {
    const [route, fragment] = entry.to.split('#');
    const file = await siteFile(root, route);
    let html;
    try { html = await fs.readFile(file, 'utf8'); } catch { throw new Error(`Missing school target: ${entry.to}`); }
    const noindex = (html.match(/<meta\b[^>]*>/gi) || []).some(tag => /\bname\s*=\s*["']robots["']/i.test(tag) && /\bcontent\s*=\s*["'][^"']*noindex/i.test(tag));
    if (html.includes(REDIRECT_MARKER) || noindex) throw new Error(`School target is not active: ${entry.to}`);
    if (fragment) {
      const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`\\s+id\\s*=\\s*(["'])${escaped}\\1`, 'i').test(html)) throw new Error(`Missing school target fragment: ${entry.to}`);
    }
  }
  return { targetsValidated: prepared.redirects.length };
}

export function rewriteSchoolUrl(value, exact, { canonical = false } = {}) {
  if (typeof value !== 'string') return value;
  // Preserve root-relative versus absolute same-domain style; unrelated external URLs never change.
  let prefix = '';
  let rest = value;
  const absolute = /^(https?:\/\/[^/?#]+)(\/[^]*)$/.exec(value);
  if (absolute) {
    if (!/^https?:\/\/(?:www\.)?sgeda\.org\.cn$/i.test(absolute[1])) return value;
    prefix = ORIGIN;
    rest = absolute[2];
  } else if (!value.startsWith('/') || value.startsWith('//')) return value;
  const match = /^([^?#]+)(\?[^#]*)?(#[^]*)?$/.exec(rest);
  if (!match || !exact.has(match[1])) return value;
  const target = exact.get(match[1]);
  const [route, schoolHash] = target.split('#');
  // A policy school fragment wins over an old section or schema-entity fragment.
  const hash = canonical ? '' : schoolHash ? `#${schoolHash}` : (match[3] || '');
  return `${prefix}${route}${canonical ? '' : (match[2] || '')}${hash}`;
}

function rewriteJsStrings(text, exact) {
  return text.replace(/\/\/[^\n]*|\/\*[^]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, (whole, offset) => {
    if (!/^["'`]/.test(whole)) return whole;
    const quote = whole[0];
    const value = whole.slice(1, -1);
    if (value.includes('\\') || value.includes('${')) return whole;
    if (/["']?\b(?:name|nameZh|nameEn|description|title|label)["']?\s*[:=]\s*$/.test(text.slice(Math.max(0, offset - 100), offset))) return whole;
    const next = rewriteSchoolUrl(value, exact);
    return next === value ? whole : `${quote}${next}${quote}`;
  });
}

export function rewriteSchoolReferenceText(text, exact, { javascript = false } = {}) {
  if (javascript) return rewriteJsStrings(text, exact);
  // Work on tags and script bodies only; never serialize or reformat a document body.
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<!--[^]*?-->|<[^>]+>/gi, token => {
    if (token.startsWith('<!--')) return token;
    if (/^<script\b/i.test(token)) {
      if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(token)) {
        return token.replace(/("(?:@id|url|item|sameAs)"\s*:\s*)("(?:\\.|[^"\\])*")/g, (whole, key, literal) => {
          let value;
          try { value = JSON.parse(literal); } catch { return whole; }
          const next = rewriteSchoolUrl(value, exact);
          return next === value ? whole : key + JSON.stringify(next);
        });
      }
      const end = token.indexOf('>') + 1;
      return token.slice(0, end) + rewriteJsStrings(token.slice(end), exact);
    }
    const canonical = /^<link\b/i.test(token) && /\brel\s*=\s*["']canonical["']/i.test(token);
    return token.replace(/(\s+)(href|onclick)\s*=\s*(["'])([^]*?)\3/gi, (whole, whitespace, attribute, quote, value) => {
      if (attribute.toLowerCase() === 'onclick') {
        const decoded = value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
        const next = rewriteJsStrings(decoded, exact);
        return next === decoded ? whole : `${whitespace}${attribute}=${quote}${next.replace(/&/g, '&amp;').replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&#39;')}${quote}`;
      }
      const decoded = value.replace(/&amp;/g, '&');
      const next = rewriteSchoolUrl(decoded, exact, { canonical });
      return next === decoded ? whole : `${whitespace}${attribute}=${quote}${htmlEscape(next)}${quote}`;
    });
  });
}

export async function rewriteSchoolReferences(root = process.cwd(), options = {}) {
  const prepared = options.prepared || await loadInputs(root, options);
  const ignored = new Set(['.git', '.github', 'node_modules', 'content', 'data', 'scripts', 'tests', 'docs', 'reports']);
  const changed = [];
  async function visit(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue;
      const file = path.join(directory, item.name);
      if (item.isDirectory()) { if (!ignored.has(item.name)) await visit(file); continue; }
      if (!item.isFile() || !/\.(html|js)$/.test(item.name)) continue;
      const relative = path.relative(root, file).split(path.sep).join('/');
      const route = `/${relative.replace(/index\.html$/, '')}`;
      if (DATABASE_PAGES.has(route) || relative === 'assets/school-database.js') continue;
      const before = await fs.readFile(file, 'utf8');
      if (before.includes(REDIRECT_MARKER)) continue;
      const after = rewriteSchoolReferenceText(before, prepared.exact, { javascript: item.name.endsWith('.js') });
      if (before !== after) { changed.push(relative); if (!options.dryRun) await fs.writeFile(file, after); }
    }
  }
  await visit(path.resolve(root));
  return { referencesChanged: changed };
}

export async function migrateSchoolPages(root = process.cwd(), options = {}) {
  root = path.resolve(root);
  const prepared = await loadInputs(root, options);
  // Default is safe for the final build. Fixtures/staging can explicitly skip validation.
  if (options.validateTargets !== false || options.validateOnly) await validateSchoolMigrationTargets(root, { prepared });
  if (options.validateOnly) return { targetsValidated: prepared.redirects.length, filesChanged: [] };
  const filesChanged = [];
  async function writeIfChanged(file, content) {
    let before;
    try { before = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (before === content) return;
    filesChanged.push(path.relative(root, file));
    if (!options.dryRun) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); }
  }
  const references = options.rewriteReferences !== false ? await rewriteSchoolReferences(root, { prepared, dryRun: options.dryRun }) : { referencesChanged: [] };
  for (const entry of prepared.redirects) await writeIfChanged(await siteFile(root, entry.from), renderSchoolRedirectHtml(entry));
  const includeFile = path.join(root, 'data/seo/school-redirects.nginx.conf');
  await siteFile(root, '/data/seo/');
  await writeIfChanged(includeFile, renderSchoolNginxRules(prepared));
  return { redirects: prepared.redirects.length, nginxRules: prepared.exact.size, filesChanged, ...references };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = new Set(process.argv.slice(2));
  const allowed = new Set(['--validate-targets', '--validate-only', '--skip-target-validation', '--rewrite-references', '--skip-reference-rewrite', '--dry-run']);
  if ([...args].some(argument => !allowed.has(argument))) throw new Error('Unknown migration option');
  const result = await migrateSchoolPages(process.cwd(), {
    validateTargets: !args.has('--skip-target-validation'), validateOnly: args.has('--validate-only'),
    rewriteReferences: !args.has('--skip-reference-rewrite'), dryRun: args.has('--dry-run'),
  });
  console.log(JSON.stringify(result, null, 2));
}
