import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { SITE, inspectPage } from '../scripts/seo-pages.mjs';
import { readEntrySeoConfig, syncEntryPageHtml, syncEntrySeo, inspectEntrySeo } from '../scripts/sync-entry-seo.mjs';
import { enhancePageHtml } from '../scripts/enhance-key-seo-pages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = readEntrySeoConfig(root);
const org = JSON.parse(fs.readFileSync(path.join(root, 'content/organization.json'), 'utf8'));
const schema = node => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
const definitions = html => { const $ = load(html); return $('script[type="application/ld+json"]').toArray().flatMap(el => { const data = JSON.parse($(el).text()); return Array.isArray(data) ? data : data['@graph'] || [data]; }); };
function fixture(entry, extra = '') {
  const url = SITE + entry.route;
  const website = { '@type': 'WebSite', name: config.siteName, url: SITE + '/', alternateName: ['旧名字'], potentialAction: { '@type': 'SearchAction', target: SITE + '/search/?q={search_term_string}' } };
  const page = { '@type': 'WebPage', url, name: '旧标题', description: '原有摘要', datePublished: '2026-07-12', dateModified: '2026-11-26', citation: ['https://www.seab.gov.sg/'], publisher: { '@type': 'Organization', name: config.siteName }, isPartOf: website };
  const identity = entry.route === '/' ? schema(website) + schema({ '@type': 'EducationalOrganization', name: org.name, legalName: org.legalName, url: org.url, address: '旧独立副本' }) + schema(org) : '';
  return `<!doctype html><html><head><title>旧标题</title><meta name="description" content="原有摘要"><link rel="canonical" href="${url}">${identity}${schema(page)}${schema({ '@type': 'FAQPage', mainEntity: [{ name: '实际问答', acceptedAnswer: { text: '原有答案' } }] })}${extra}</head><body><header>不变导航</header><main><h1 class="original">原有标题</h1><p><a href="https://www.seab.gov.sg/">正文依据</a></p><svg><title>图形标题不能改</title></svg></main><footer>不变页脚</footer></body></html>`;
}

test('eleven actual keyword entries retain final search metadata without requiring social tags', () => {
  assert.equal(config.entries.length, 11);
  assert.equal(new Set(config.entries.map(entry => entry.primaryKeyword)).size, config.entries.length - 1);
  for (const entry of config.entries) {
    const file = path.join(root, entry.route, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    assert.deepEqual(inspectEntrySeo(html, entry, config, org), [], entry.route);
    assert.equal(inspectPage(html, SITE + entry.route).issues.length, 0, entry.route);
  }
});

test('homepage reuses one WebSite and one organization with actual brand aliases', () => {
  const entry = config.entries[0];
  const result = syncEntryPageHtml(fixture(entry), entry, config, org);
  const data = definitions(result);
  const website = data.find(node => node['@type'] === 'WebSite');
  assert.equal(data.filter(node => node['@type'] === 'WebSite').length, 1);
  assert.equal(data.filter(node => ['Organization', 'EducationalOrganization'].includes(node['@type'])).length, 1);
  assert.equal(website['@id'], SITE + '/#website');
  assert.equal(website.publisher['@id'], org['@id']);
  assert.deepEqual(website.alternateName, ['新加坡择校网', 'SEDA']);
  assert.equal(website.potentialAction.target, SITE + '/search/?q={search_term_string}');
  assert.equal(load(result)('h1').text(), 'SEDA 新加坡择校网 留学与升学指南');
  assert.equal(load(result)('h1 .w').length, 3);
  assert.deepEqual(data.find(node => node['@type'] === 'Organization'), org);
});

test('sync is byte-idempotent and leaves body, SVG, layout and source facts unchanged', () => {
  const entry = config.entries.find(node => node.route === '/wace/');
  const before = fixture(entry);
  const after = syncEntryPageHtml(before, entry, config, org);
  assert.equal(after.slice(after.indexOf('<body>')), before.slice(before.indexOf('<body>')));
  assert.equal(syncEntryPageHtml(after, entry, config, org), after);
  const page = definitions(after).find(node => node['@type'] === 'WebPage');
  assert.equal(page.datePublished, '2026-07-12');
  assert.equal(page.dateModified, '2026-11-26');
  assert.deepEqual(page.citation, ['https://www.seab.gov.sg/']);
  assert.equal(page.publisher['@id'], org['@id']);
  assert.equal(page.isPartOf['@id'], SITE + '/#website');
  assert.deepEqual(definitions(after).find(node => node['@type'] === 'FAQPage'), definitions(before).find(node => node['@type'] === 'FAQPage'));
  assert.equal(load(after)('meta[property^="og:"],meta[name^="twitter:"]').length, 0);
});

test('search metadata is escaped, old social tags are not maintained, visible WeChat image stays', () => {
  const entry = { ...config.entries[4], title: 'WACE "A & B" <说明>', description: 'A < B & "C"' };
  const legacy = '<meta property="og:image" content="https://sgeda.org.cn/assets/real.jpg"><meta name="twitter:card" content="summary">';
  const html = fixture(entry, legacy).replace('</main>', '<img src="/assets/wechat-amy-seda-guide.jpg" alt="微信二维码"></main>');
  const result = syncEntryPageHtml(html, entry, config, org);
  const $ = load(result);
  assert.equal($('head > title').text(), entry.title);
  assert.equal($('meta[name="description"]').attr('content'), entry.description);
  assert.ok(result.includes(legacy));
  assert.equal($('meta[property="og:title"],meta[name="twitter:title"]').length, 0);
  assert.equal($('img[alt="微信二维码"]').attr('src'), '/assets/wechat-amy-seda-guide.jpg');
  assert.ok(result.includes('\\u003c'));
});

test('array and graph schemas retain unrelated organizations and unknown nodes', () => {
  const entry = config.entries[0];
  const extra = schema({ '@graph': [{ '@type': 'Organization', name: '另一所学校', url: 'https://school.example/' }, { '@type': 'Thing', name: '保留对象' }] });
  const after = syncEntryPageHtml(fixture(entry, extra), entry, config, org);
  assert.ok(definitions(after).some(node => node.name === '另一所学校'));
  assert.ok(definitions(after).some(node => node.name === '保留对象'));
});

test('malformed JSON-LD, duplicate search meta and wrong canonical still fail', () => {
  const entry = config.entries[4];
  assert.throws(() => syncEntryPageHtml(fixture(entry, '<script type="application/ld+json">BROKEN</script>'), entry, config, org), /Invalid JSON-LD/);
  assert.throws(() => syncEntryPageHtml(fixture(entry, '<meta name="keywords" content="one"><meta name="keywords" content="two">'), entry, config, org), /Duplicate/);
  assert.throws(() => syncEntryPageHtml(fixture(entry).replace(SITE + entry.route, 'https://wrong.example/'), entry, config, org), /Canonical/);
});

test('filesystem sync prevalidates all targets, check-only never writes, later missing entry causes zero writes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-entry-seo-'));
  const pair = { ...config, entries: [config.entries[0], config.entries[4]] };
  try {
    fs.mkdirSync(path.join(temp, 'content'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'content/seo-entry-pages.json'), JSON.stringify(pair));
    fs.writeFileSync(path.join(temp, 'content/organization.json'), JSON.stringify(org));
    fs.writeFileSync(path.join(temp, 'index.html'), fixture(pair.entries[0]));
    const original = fs.readFileSync(path.join(temp, 'index.html'), 'utf8');
    assert.throws(() => syncEntrySeo(temp), /Missing SEO entry/);
    assert.equal(fs.readFileSync(path.join(temp, 'index.html'), 'utf8'), original);
    fs.mkdirSync(path.join(temp, 'wace'));
    fs.writeFileSync(path.join(temp, 'wace/index.html'), fixture(pair.entries[1]));
    assert.ok(syncEntrySeo(temp, { checkOnly: true }).issues.length > 0);
    assert.equal(fs.readFileSync(path.join(temp, 'index.html'), 'utf8'), original);
    assert.equal(syncEntrySeo(temp).updated, 2);
    assert.deepEqual(syncEntrySeo(temp, { checkOnly: true }).issues, []);
    assert.equal(syncEntrySeo(temp).updated, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('basic inspector still detects duplicate search fields, duplicate H1 and broken JSON', () => {
  const entry = config.entries[4];
  const broken = fixture(entry, '<meta name="description" content="重复"><script type="application/ld+json">BROKEN</script>').replace('</main>', '<h1>第二标题</h1></main>');
  const issues = inspectPage(broken, SITE + entry.route).issues;
  for (const issue of ['duplicate description', 'duplicate h1', 'invalid JSON-LD']) assert.ok(issues.includes(issue), issue);
});

test('social tags are not a condition of search SEO eligibility', () => {
  const entry = config.entries[4];
  const original = fixture(entry, '<meta property="og:title" content="旧分享标题"><meta property="og:url" content="https://other.example/"><meta name="twitter:card" content="summary">');
  assert.deepEqual(inspectPage(original, SITE + entry.route).issues, []);
  const after = syncEntryPageHtml(original, entry, config, org);
  assert.deepEqual(inspectEntrySeo(after, entry, config, org), []);
  assert.ok(after.includes('<meta property="og:title" content="旧分享标题"><meta property="og:url" content="https://other.example/"><meta name="twitter:card" content="summary">'));
});

test('existing key-page enhancer references stable site and organization IDs', () => {
  const entry = config.entries[4];
  const result = enhancePageHtml(fixture(entry), SITE + entry.route);
  const page = definitions(result).filter(node => node['@type'] === 'WebPage').at(-1);
  assert.equal(page.isPartOf['@id'], SITE + '/#website');
  assert.equal(page.publisher['@id'], org['@id']);
});
