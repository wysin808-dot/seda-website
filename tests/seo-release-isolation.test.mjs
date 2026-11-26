import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from 'cheerio';

// CI reads only this checkout and the committed fixture. Git is used ONLY by the
// explicit, offline --generate-fixture maintenance command, never by tests.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/seo-release-baseline.json');
const HEAD = 'dcaa91e665fe8dbff42f7d66f94e58ba69bbbfc3';
const SITE = 'https://sgeda.org.cn';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const sortRows = rows => [...rows].sort((a, b) => a.url.localeCompare(b.url));
const FOREIGN_START = '<!-- SEDA_FOREIGN_UNIVERSITY_ENTRY_START -->';
const FOREIGN_END = '<!-- SEDA_FOREIGN_UNIVERSITY_ENTRY_END -->';
const EDITABLE_EXISTING = new Set([
  'scripts/build-content.mjs', 'scripts/enhance-key-seo-pages.mjs',
  'scripts/seo-pages.mjs', 'scripts/seo-check.mjs',
  'tests/focus-pages.test.mjs', 'tests/news-topic-regression.test.mjs',
  'tests/reviewed-pages.test.mjs', 'tests/title-accuracy.test.mjs',
  'sitemap.xml', 'baidu-sitemap.xml', 'feed.xml', 'rss.xml', 'llms.txt',
  'data/seo/page-updates.json',
]);
const ALLOWED_NEW = new Set([
  'content/seo-entry-pages.json', 'scripts/render-news-index.mjs',
  'scripts/sync-entry-seo.mjs', 'scripts/sync-foreign-university-entry.mjs',
  'news/news.css', 'news/news.js', 'tests/entry-seo.test.mjs',
  'tests/foreign-university-entry.test.mjs', 'tests/news-categories.test.mjs',
  'tests/news-filtering.test.mjs', 'tests/seo-release-isolation.test.mjs',
  'tests/fixtures/seo-release-baseline.json',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
}
function maskStableEntityIds(value) {
  if (Array.isArray(value)) return value.map(maskStableEntityIds);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, maskStableEntityIds(child)]));
  const types = [].concat(value['@type'] ?? []);
  if ((types.some(type => ['Organization', 'EducationalOrganization'].includes(type)) && value['@id'] === `${SITE}/#organization`)
    || (types.includes('WebSite') && value['@id'] === `${SITE}/#website`)) delete result['@id'];
  return canonicalJson(result);
}
function parseMarkdown(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  assert.ok(match, `Missing HEAD frontmatter: ${file}`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index < 0) continue;
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    meta[line.slice(0, index).trim()] = value === 'true' ? true : value === 'false' ? false : value;
  }
  const body = match[2].trim();
  const url = `/${meta.category || 'guides'}/${meta.slug || meta.title}/`.replace(/\/+/g, '/');
  return { file, meta, body, url, summary: (body.match(/^##\s+(.+)$/m)?.[1] || '').trim() || meta.description || '' };
}
function domNode(node) {
  if (node.type === 'comment') return ['comment', normalize(node.data)];
  if (node.type === 'text') return normalize(node.data) ? ['text', normalize(node.data)] : null;
  if (!node.name) return null;
  const attrs = canonicalJson(node.attribs || {});
  if (node.name === 'script' && attrs.type === 'application/ld+json') {
    const raw = (node.children || []).map(child => child.data || '').join('');
    return ['script', attrs, maskStableEntityIds(JSON.parse(raw))];
  }
  // Script/style/pre whitespace is meaningful; ordinary HTML formatting is not.
  if (['script', 'style', 'pre', 'textarea'].includes(node.name)) {
    return [node.name, attrs, (node.children || []).map(child => child.type === 'text' ? ['raw', child.data] : domNode(child)).filter(Boolean)];
  }
  return [node.name, attrs, (node.children || []).map(domNode).filter(Boolean)];
}
function signatureNodes(nodes) { return sha(JSON.stringify(nodes.map(domNode).filter(Boolean))); }
function maskedBodyBytes(rawBody) {
  return rawBody.replace(/(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_, open, raw, close) => open + JSON.stringify(maskStableEntityIds(JSON.parse(raw))) + close);
}
function stripForeignBlock(html) {
  const starts = html.split(FOREIGN_START).length - 1;
  const ends = html.split(FOREIGN_END).length - 1;
  assert.equal(starts, ends, 'University entry markers must pair');
  assert.ok(starts <= 1, 'University entry range must be unique');
  if (!starts) return html;
  const a = html.indexOf(FOREIGN_START), b = html.indexOf(FOREIGN_END);
  assert.ok(b > a, 'University entry markers must be ordered');
  const block = html.slice(a, b + FOREIGN_END.length);
  const $ = load(block, null, false);
  assert.equal($('section').length, 1, 'Only one foreign university entry section is allowed');
  assert.equal($('a').length, 1, 'Foreign university entry has one destination');
  assert.equal($('a').attr('href'), '/foreign-university/');
  assert.equal($('script,style,iframe,form').length, 0, 'Entry must not inject executable content');
  assert.equal(normalize($('p.lead').text()), '本页聚焦新加坡本地公立大学与艺术大学；如需比较海外大学在新加坡的校区，可查看 海外名校新加坡校区栏目。该栏目涉及商科本科、MBA / EMBA、工程硕士等不同层级项目，请按各校详情区分申请对象，不要与本页公立大学本科录取分混用。');
  return html.slice(0, a) + html.slice(b + FOREIGN_END.length);
}
function bodySnapshot(html, file) {
  const rawBody = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  assert.notEqual(rawBody, undefined, `Missing body: ${file}`);
  const $ = load(file === 'university/index.html' ? stripForeignBlock(html) : html);
  if (['index.html', 'university/index.html'].includes(file)) {
    assert.equal($('h1').length, 1, `One entry H1 required: ${file}`);
    $('h1').empty().text('__AUTHORIZED_ENTRY_H1__');
  }
  if (file === 'news/index.html') {
    assert.equal($('body > main').length, 1, 'News has exactly one main');
    $('body > main').remove();
    $('body > script[src="/news/news.js?v=1"]').remove();
    return { rawBodySha256: sha(rawBody), signatureSha256: signatureNodes($('body').contents().toArray()), policy: 'news-shell-outside-main' };
  }
  return { rawBodySha256: sha(rawBody), entityMaskedBodySha256: sha(maskedBodyBytes(rawBody)), signatureSha256: signatureNodes($('body').toArray()), policy: ['index.html', 'university/index.html'].includes(file) ? 'only-authorized-entry-ranges' : 'entire-body' };
}
function pageMetadata(html) {
  const $ = load(html);
  const values = (selector, attr) => $(selector).toArray().map(node => attr ? $(node).attr(attr) ?? null : $(node).text());
  return {
    title: values('head > title'),
    description: values('meta[name="description"]', 'content'),
    canonical: values('link[rel="canonical"]', 'href'),
    metadata: $('head meta').toArray().map(node => canonicalJson(node.attribs)),
    schemas: $('script[type="application/ld+json"]').toArray().map(node => maskStableEntityIds(JSON.parse($(node).text()))),
    times: $('time').toArray().map(node => ({ text: $(node).text(), datetime: $(node).attr('datetime') ?? null })),
  };
}
function sitemapUrls(raw) {
  const $ = load(raw, { xmlMode: true });
  return $('urlset > url > loc').toArray().map(node => $(node).text()).sort();
}
function feedSnapshot(raw) {
  const $ = load(raw, { xmlMode: true });
  const fields = ['title', 'link', 'guid', 'pubDate', 'category', 'description'];
  return {
    channel: Object.fromEntries(['title', 'link', 'description', 'language'].map(key => [key, $('channel').children(key).text()])),
    items: $('channel > item').toArray().map(node => Object.fromEntries(fields.map(key => [key, $(node).children(key).text()]))),
  };
}
function llmsEntries(raw) {
  return raw.split(/\r?\n/).map(line => line.match(/^- \[(.*?)\]\((.*?)\): (.*)$/)).filter(Boolean)
    .map(match => ({ title: match[1], url: new URL(match[2], SITE).href, description: match[3] }));
}
function walk(directory, relative = '') {
  const result = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(item.name)) continue;
    const name = relative ? `${relative}/${item.name}` : item.name;
    if (item.isDirectory()) result.push(...walk(path.join(directory, item.name), name));
    else if (item.isFile() || item.isSymbolicLink()) result.push(name);
  }
  return result.sort();
}
function protectable(file) {
  return !EDITABLE_EXISTING.has(file) && !file.endsWith('.html')
    && (!file.endsWith('.md') || file.startsWith('content/articles/'));
}
function block(source, name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `Unique baseline build function: ${name}`);
  return source.slice(start, end);
}
function expectedBuild(headBuild) {
  let result = headBuild;
  const replace = (before, after) => {
    assert.equal(result.split(before).length - 1, 1, `Exact HEAD build anchor: ${before.slice(0, 80)}`);
    result = result.replace(before, after);
  };
  replace("import { optimizeArticle } from './seo-optimizer.mjs';", "import { optimizeArticle } from './seo-optimizer.mjs';\nimport { renderNewsArchive } from './render-news-index.mjs';");
  replace("import { syncPathwayCatalogNavigation } from './sync-pathway-catalog-navigation.mjs';", "import { syncPathwayCatalogNavigation } from './sync-pathway-catalog-navigation.mjs';\nimport { syncForeignUniversityEntry } from './sync-foreign-university-entry.mjs';\nimport { syncEntrySeo } from './sync-entry-seo.mjs';");
  replace("    author: { '@type': 'Organization', name: 'SEDA 新加坡择校网' },", "    author: { '@type': 'Organization', '@id': `${domain}/#organization`, name: 'SEDA 新加坡择校网' },");
  replace("    publisher: {\n      '@type': 'Organization',\n      name: 'SEDA 新加坡择校网',", "    publisher: {\n      '@type': 'Organization',\n      '@id': `${domain}/#organization`,\n      name: 'SEDA 新加坡择校网',");
  replace("    isPartOf: {\n      '@type': 'WebSite',\n      name: 'SEDA 新加坡择校网',", "    isPartOf: {\n      '@type': 'WebSite',\n      '@id': `${domain}/#website`,\n      name: 'SEDA 新加坡择校网',");
  const newsFunction = [
    'function updateNewsIndex(articles) {',
    "  const file = path.join(root, 'news', 'index.html');", '  let html = read(file);',
    "  const start = '<!-- GENERATED_ARTICLES_START -->';", "  const end = '<!-- GENERATED_ARTICLES_END -->';",
    '  const archive = renderNewsArchive(articles);', '  const block = `${start}\\n${archive}\\n        ${end}`;',
    '  if (!html.includes(start) || !html.includes(end)) {', "    throw new Error('News archive generation markers are required');", '  }',
    '  html = html.replace(new RegExp(`${start}[\\\\s\\\\S]*?${end}`), block);',
    "  fs.writeFileSync(file, html, 'utf8');", '}', ''
  ].join('\n');
  replace(block(result, 'updateNewsIndex'), newsFunction);
  replace('const urlCount = updateSitemap(drafts);', 'syncForeignUniversityEntry(root);\nconst entrySeo = syncEntrySeo(root);\nconst urlCount = updateSitemap(drafts);');
  return result;
}

function approvedLockPatch(headRaw) {
  const before = JSON.parse(headRaw), actual = JSON.parse(read('package-lock.json'));
  const versions = {
    'node_modules/@nodable/entities': ['3.0.0', '3.1.0'],
    'node_modules/fast-xml-builder': ['1.3.1', '1.3.2'],
    'node_modules/fast-xml-parser': ['5.11.1', '5.12.1'],
    'node_modules/is-unsafe': ['2.0.2', '2.0.3'],
    'node_modules/strnum': ['2.4.2', '2.5.1'],
    'node_modules/undici': ['7.29.1', '7.30.2'],
  };
  assert.deepEqual(Object.keys(actual.packages).sort(), Object.keys(before.packages).sort(), 'Security patch must not add/remove lock nodes');
  const expected = structuredClone(before);
  const nodes = [];
  for (const [node, [oldVersion, newVersion]] of Object.entries(versions)) {
    const old = before.packages[node], next = actual.packages[node];
    assert.equal(old.version, oldVersion, node); assert.equal(next.version, newVersion, node);
    assert.ok(next.resolved.startsWith('https://registry.npmjs.org/'), node);
    assert.ok(/^sha512-/.test(next.integrity), node);
    const oldOther = { ...old }, nextOther = { ...next };
    for (const field of ['version', 'resolved', 'integrity']) { delete oldOther[field]; delete nextOther[field]; }
    if (node === 'node_modules/fast-xml-parser') {
      assert.deepEqual(next.dependencies, { ...old.dependencies,
        '@nodable/entities': '^3.1.0', 'fast-xml-builder': '^1.3.2', 'is-unsafe': '^2.0.3', 'strnum': '^2.5.1' });
      delete oldOther.dependencies; delete nextOther.dependencies;
    }
    assert.deepEqual(nextOther, oldOther, `No unrelated metadata change in ${node}`);
    expected.packages[node] = next;
    nodes.push({ path: node, beforeVersion: oldVersion, afterVersion: newVersion, before: old, after: next });
  }
  for (const node of Object.keys(before.packages)) {
    if (!Object.hasOwn(versions, node)) assert.deepEqual(actual.packages[node], before.packages[node], `Unapproved lock node: ${node}`);
  }
  return { authorization: 'Parent explicitly approved these six security nodes on 2026-11-26; not HEAD byte equality. Original package.json and every other lock node/top-level field remain HEAD.',
    originalLockSha256: sha(headRaw), originalLock: before, approvedNodes: nodes,
    expectedPatchedLockSha256: sha(JSON.stringify(expected, null, 2) + '\n'),
    auditEvidence: 'Parent-provided npm-audit-after-patch.json reported vulnerabilities.total=0; this CI isolation test does not perform a live security audit.' };
}

function generateFixture(readinessFile) {
  assert.ok(readinessFile, 'Pass the audit readiness JSON path to --generate-fixture');
  const git = args => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(git(['rev-parse', HEAD]).toString().trim(), HEAD);
  const files = git(['ls-tree', '-r', '--name-only', HEAD]).toString().trim().split('\n').sort();
  const cache = new Map();
  const get = file => { if (!cache.has(file)) cache.set(file, git(['show', `${HEAD}:${file}`])); return cache.get(file); };
  const markdownFiles = files.filter(file => file.startsWith('content/articles/') && file.endsWith('.md'));
  const articles = markdownFiles.filter(file => !path.basename(file).startsWith('_')).map(file => parseMarkdown(get(file).toString(), file));
  const published = articles.filter(article => !article.meta.draft);
  assert.equal(published.length, 85, 'Derive News count from actual HEAD Markdown, not summary counts');
  assert.equal(new Set(published.map(article => article.url)).size, published.length);
  const readiness = JSON.parse(fs.readFileSync(readinessFile, 'utf8'));
  assert.equal(readiness.revisions.length, 14);
  const htmlBodies = {};
  for (const file of files.filter(file => file.endsWith('.html') && !file.startsWith('tests/'))) {
    const html = get(file).toString();
    if (/<body\b/i.test(html)) htmlBodies[file] = bodySnapshot(html, file);
  }
  const revisions = readiness.revisions.map(revision => {
    assert.ok(markdownFiles.includes(revision.file));
    const markdown = get(revision.file).toString();
    const article = parseMarkdown(markdown, revision.file);
    assert.equal(article.meta.draft, false);
    const htmlFile = `${article.url.slice(1)}index.html`;
    const html = get(htmlFile).toString();
    const metadata = pageMetadata(html);
    assert.deepEqual(metadata.canonical, [SITE + article.url]);
    return { file: revision.file, htmlFile, canonical: SITE + article.url, oldMarkdown: markdown,
      oldMarkdownMeta: article.meta, oldMarkdownBodySha256: sha(article.body),
      oldHtmlBody: html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)[1], metadata };
  });
  const maps = Object.fromEntries(['sitemap.xml', 'baidu-sitemap.xml'].map(file => [file, sitemapUrls(get(file).toString())]));
  assert.equal(maps['sitemap.xml'].length, 265); assert.equal(maps['baidu-sitemap.xml'].length, 125);
  const fixture = {
    formatVersion: 1, baselineCommit: HEAD,
    provenance: 'Offline git show of deployed HEAD; revision list supplies only file identities. No revised source or remote facts enter expectations.',
    normalization: 'Every ordinary/old article body is byte-protected outside JSON-LD; JSON-LD permits only exact stable Organization/WebSite IDs and serialization formatting. The two entry pages and News shell use DOM signatures, ignoring ordinary formatting whitespace. Only home H1, university H1/marked foreign entry, and News main/new JS/body class are exempt.',
    counts: { markdownFiles: markdownFiles.length, publishedMarkdown: published.length, protectedBodies: Object.keys(htmlBodies).length, revisions: revisions.length },
    trackedFiles: files,
    markdownSha256: Object.fromEntries(markdownFiles.map(file => [file, sha(get(file))])),
    protectedSha256: Object.fromEntries(files.filter(file => protectable(file) || (file.endsWith('.html') && !htmlBodies[file])).map(file => [file, sha(get(file))])),
    allowedBuildSha256: sha(expectedBuild(get('scripts/build-content.mjs').toString())),
    htmlBodies, revisions,
    publishedArticles: sortRows(published.map(article => ({ url: SITE + article.url, title: article.meta.title,
      description: article.meta.description || article.summary || '', date: String(article.meta.date || ''),
      category: article.meta.category, sourceFile: article.file, sourceSha256: sha(get(article.file)) }))),
    sitemaps: maps,
    feeds: Object.fromEntries(['feed.xml', 'rss.xml'].map(file => [file, feedSnapshot(get(file).toString())])),
    llmsEntries: llmsEntries(get('llms.txt').toString()),
    entryH1: { 'index.html': 'SEDA 新加坡择校网 留学与升学指南', 'university/index.html': '新加坡大学与本科专业查询' },
  };
  if (process.argv.includes('--approved-lock-patch')) fixture.securityLockException = approvedLockPatch(get('package-lock.json').toString());
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
  console.log(JSON.stringify({ fixture: FIXTURE, baselineCommit: HEAD, ...fixture.counts, sitemap: maps['sitemap.xml'].length, baiduSitemap: maps['baidu-sitemap.xml'].length, testsExecuted: false }));
}

if (process.argv.includes('--generate-fixture')) {
  generateFixture(process.argv[process.argv.indexOf('--generate-fixture') + 1]);
} else {
  const baseline = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  test('isolation fixture is bound to deployed HEAD and exact old article source identities', () => {
    assert.equal(baseline.formatVersion, 1); assert.equal(baseline.baselineCommit, HEAD);
    assert.equal(baseline.revisions.length, 14); assert.equal(baseline.publishedArticles.length, 85);
    assert.equal(baseline.sitemaps['sitemap.xml'].length, 265); assert.equal(baseline.sitemaps['baidu-sitemap.xml'].length, 125);
    for (const revision of baseline.revisions) {
      assert.equal(sha(revision.oldMarkdown), baseline.markdownSha256[revision.file]);
      const parsed = parseMarkdown(revision.oldMarkdown, revision.file);
      assert.equal(SITE + parsed.url, revision.canonical);
      assert.deepEqual(parsed.meta, revision.oldMarkdownMeta);
      assert.equal(sha(parsed.body), revision.oldMarkdownBodySha256);
      assert.equal(sha(revision.oldHtmlBody), baseline.htmlBodies[revision.htmlFile].rawBodySha256);
    }
  });
  test('every article Markdown, including drafts/templates, and sources.json retain HEAD bytes', () => {
    const actual = walk(path.join(ROOT, 'content/articles')).map(file => `content/articles/${file}`).filter(file => file.endsWith('.md'));
    assert.deepEqual(actual, Object.keys(baseline.markdownSha256).sort(), 'No added, missing, renamed article Markdown');
    for (const [file, expected] of Object.entries(baseline.markdownSha256)) assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), expected, file);
    assert.equal(sha(fs.readFileSync(path.join(ROOT, 'content/sources.json'))), baseline.protectedSha256['content/sources.json']);
  });
  test('14 pending revisions retain old body, search/social metadata, canonical, all dates and citation by canonical', () => {
    for (const revision of baseline.revisions) {
      const html = read(revision.htmlFile);
      assert.deepEqual(pageMetadata(html), revision.metadata, revision.canonical);
      assert.equal(bodySnapshot(html, revision.htmlFile).entityMaskedBodySha256, baseline.htmlBodies[revision.htmlFile].entityMaskedBodySha256, `Body bytes: ${revision.canonical}`);
      assert.equal(bodySnapshot(html, revision.htmlFile).signatureSha256, baseline.htmlBodies[revision.htmlFile].signatureSha256, revision.canonical);
    }
  });
  test('News contains all 85 old source-backed links/titles/descriptions and original publication dates', () => {
    const $ = load(read('news/index.html'));
    const rows = $('.news-archive .news-article').toArray().map(node => {
      const article = $(node), link = article.find('h3 > a'), time = article.find('time');
      assert.equal(link.length, 1); assert.equal(time.length, 1);
      assert.equal(time.attr('datetime'), time.text(), `News original date: ${link.attr('href')}`);
      return { url: new URL(link.attr('href'), SITE).href, title: link.text(),
        description: article.find('.news-article-description').text(), date: time.text(),
        category: article.closest('[data-news-category]').attr('data-news-category') };
    });
    assert.equal(rows.length, 85); assert.equal(new Set(rows.map(row => row.url)).size, 85);
    assert.deepEqual(sortRows(rows), baseline.publishedArticles.map(({ sourceFile, sourceSha256, ...row }) => row));
    const schemaNodes = $('script#news-article-list-schema'); assert.equal(schemaNodes.length, 1);
    const schema = JSON.parse(schemaNodes.text()); assert.equal(schema.numberOfItems, 85);
    assert.deepEqual(schema.itemListElement.map(item => ({ url: item.url, title: item.name })), rows.map(row => ({ url: row.url, title: row.title })));
  });
  test('feed/rss and llms keep old canonical metadata and date-key order; only equal-date ties may reorder', () => {
    // HEAD sorts by publishedAt || updated || date, without a tie-breaker.
    // Fresh Git checkouts enumerate equal-date files differently. Preserve every
    // canonical's metadata and every date-key position, not incidental tie order.
    const dateKeys = new Map(baseline.publishedArticles.map(article => {
      const raw = read(article.sourceFile);
      assert.equal(sha(raw), article.sourceSha256, `HEAD source for ordering: ${article.sourceFile}`);
      const { meta } = parseMarkdown(raw, article.sourceFile);
      return [article.url, String(meta.publishedAt || meta.updated || meta.date || '')];
    }));
    const byCanonical = (rows, field) => [...rows].sort((a, b) => a[field].localeCompare(b[field]));
    const dateTokens = (rows, field) => rows.map(row => dateKeys.has(row[field])
      ? `article-date:${dateKeys.get(row[field])}` : `static-url:${row[field]}`);
    for (const file of ['feed.xml', 'rss.xml']) {
      const actual = feedSnapshot(read(file));
      assert.deepEqual(actual.channel, baseline.feeds[file].channel, `${file}: channel unchanged`);
      assert.deepEqual(byCanonical(actual.items, 'link'), byCanonical(baseline.feeds[file].items, 'link'), `${file}: every canonical's complete old metadata unchanged`);
      assert.deepEqual(dateTokens(actual.items, 'link'), dateTokens(baseline.feeds[file].items, 'link'), `${file}: only equal HEAD date-key ties may reorder`);
      for (const revision of baseline.revisions) {
        const old = baseline.feeds[file].items.filter(item => item.link === revision.canonical);
        const next = actual.items.filter(item => item.link === revision.canonical);
        assert.deepEqual(next, old, `${file}: ${revision.canonical}`);
      }
    }
    const actual = llmsEntries(read('llms.txt'));
    assert.deepEqual(byCanonical(actual, 'url'), byCanonical(baseline.llmsEntries, 'url'), 'llms: every old canonical/title/description retained');
    assert.deepEqual(dateTokens(actual, 'url'), dateTokens(baseline.llmsEntries, 'url'), 'llms: static entries and date-key positions unchanged; only equal-date ties may reorder');
    for (const revision of baseline.revisions) assert.deepEqual(actual.filter(row => row.url === revision.canonical), baseline.llmsEntries.filter(row => row.url === revision.canonical));
  });
  test('sitemap URL sets stay exactly 265/125 with no duplicate or migrated URL', () => {
    for (const [file, expected] of Object.entries(baseline.sitemaps)) {
      const urls = sitemapUrls(read(file)); assert.equal(new Set(urls).size, urls.length, file);
      assert.deepEqual(urls, expected, `${file}: URL set unchanged (lastmod is not a URL)`);
    }
  });
  test('all existing HTML bodies retain HEAD DOM outside the three explicitly bounded uses', () => {
    const failures = [];
    for (const [file, expected] of Object.entries(baseline.htmlBodies)) {
      try {
        const actual = bodySnapshot(read(file), file);
        assert.equal(actual.signatureSha256, expected.signatureSha256);
        if (expected.policy === 'entire-body') assert.equal(actual.entityMaskedBodySha256, expected.entityMaskedBodySha256, 'Body bytes drifted');
      }
      catch (error) { failures.push(`${file}: ${error.message.split('\n')[0]}`); }
    }
    assert.deepEqual(failures, [], `Body drift:\n${failures.join('\n')}`);
    for (const [file, expected] of Object.entries(baseline.entryH1)) assert.equal(normalize(load(read(file))('h1').text()), expected, file);
    assert.ok(read('university/index.html').includes(FOREIGN_START), 'University foreign entry is present');
  });
  test('school data/301/Gitguard/robots/workflows/SSL/API/dependencies/scorer/drafters and existing WeChat assets retain HEAD bytes', () => {
    const failures = [];
    for (const [file, expected] of Object.entries(baseline.protectedSha256)) {
      if (file === 'package-lock.json' && baseline.securityLockException) continue;
      try { assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), expected); }
      catch { failures.push(file); }
    }
    assert.deepEqual(failures, [], `Out-of-scope protected byte changes:\n${failures.join('\n')}`);
    assert.equal(sha(read('scripts/build-content.mjs')), baseline.allowedBuildSha256, 'Build may change ONLY News import/render, Article entity IDs and late entry synchronization; public body/template/guards unchanged');
  });
  test('package-lock is either HEAD or the explicitly approved six-node security patch, never an unknown upgrade', () => {
    const exception = baseline.securityLockException;
    if (!exception) {
      assert.equal(sha(read('package-lock.json')), baseline.protectedSha256['package-lock.json']);
      return;
    }
    assert.equal(exception.originalLockSha256, baseline.protectedSha256['package-lock.json']);
    assert.equal(exception.approvedNodes.length, 6);
    const expected = structuredClone(exception.originalLock);
    for (const node of exception.approvedNodes) {
      assert.deepEqual(expected.packages[node.path], node.before);
      expected.packages[node.path] = node.after;
    }
    const actual = JSON.parse(read('package-lock.json'));
    assert.equal(actual.name, expected.name, 'Restore original lock top-level name; directory rename is not a security patch');
    assert.deepEqual(actual, expected, 'Exactly six approved lock nodes; all other lock fields remain HEAD');
    assert.equal(sha(read('package-lock.json')), exception.expectedPatchedLockSha256, 'Exact approved patched lock bytes');
  });
  test('no unexpected HTML, executable, asset, config or article source is added to the release', () => {
    const tracked = new Set(baseline.trackedFiles);
    const sensitive = file => /\.(?:html|mjs|cjs|js|py|sh|css|json|ya?ml|xml|png|jpe?g|svg|webp|gif|conf|csv|txt)$/.test(file)
      || /^(?:assets|content|scripts|server|api|\.github)\//.test(file)
      || ['.npmrc', '.nvmrc', '.env', '.env.production', '.env.local'].includes(file);
    const unexpected = walk(ROOT).filter(file => sensitive(file) && !tracked.has(file) && !ALLOWED_NEW.has(file));
    assert.deepEqual(unexpected, [], 'Release additions must fit the explicit SEO-only allowlist');
  });
}
