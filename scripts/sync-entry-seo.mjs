import fs from 'node:fs';
import { load } from 'cheerio';
import { SITE, localFile } from './seo-pages.mjs';

const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');
const types = node => Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
const nodes = data => Array.isArray(data) ? data : data?.['@graph'] || [data];
const schemaPattern = /<script\b([^>]*\btype=(["'])application\/ld\+json\2[^>]*)>([\s\S]*?)<\/script>/gi;

export function readEntrySeoConfig(root) {
  const config = JSON.parse(fs.readFileSync(`${root}/content/seo-entry-pages.json`, 'utf8'));
  if (config.version !== 1 || !normalize(config.siteName) || !Array.isArray(config.entries)) throw new Error('Invalid entry SEO config');
  if (!Array.isArray(config.alternateNames) || config.alternateNames.some(name => !normalize(name))) throw new Error('Invalid site alternate names');
  const routes = new Set(), titles = new Set();
  for (const entry of config.entries) {
    if (!/^\/(?:[a-z0-9-]+\/)*$/.test(entry.route) || routes.has(entry.route)) throw new Error(`Invalid or duplicate SEO route: ${entry.route}`);
    if (!normalize(entry.title) || titles.has(entry.title) || !normalize(entry.primaryKeyword) || !entry.title.includes(entry.primaryKeyword)) throw new Error(`Invalid or duplicate SEO title: ${entry.route}`);
    if (!Array.isArray(entry.keywords) || !entry.keywords.length || entry.keywords.some(word => !normalize(word)) || new Set(entry.keywords).size !== entry.keywords.length) throw new Error(`Invalid keywords: ${entry.route}`);
    if (entry.h1Parts && (entry.h1Parts.length !== 3 || entry.h1Parts.some(part => typeof part !== 'string'))) throw new Error('Homepage heading must have three text parts');
    routes.add(entry.route); titles.add(entry.title);
  }
  return config;
}

function setMeta(head, key, value, property = false) {
  const attribute = property ? 'property' : 'name';
  const $ = load(head);
  const selector = `meta[${attribute}="${key}"]`;
  if ($(selector).length > 1) throw new Error(`Duplicate ${key}`);
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  return pattern.test(head) ? head.replace(pattern, () => tag) : head.replace(/<\/head>/i, `${tag}\n</head>`);
}

function linkKnownReferences(value, config, organization) {
  if (Array.isArray(value)) return value.map(item => linkKnownReferences(item, config, organization));
  if (!value || typeof value !== 'object') return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    let linked = linkKnownReferences(child, config, organization);
    if (linked && !Array.isArray(linked) && typeof linked === 'object') {
      if (['author', 'publisher'].includes(key) && types(linked).some(type => ['Organization', 'EducationalOrganization'].includes(type))
        && (linked.name === config.siteName || linked.legalName === organization.legalName)) linked = { ...linked, '@id': organization['@id'] };
      if (key === 'isPartOf' && types(linked).includes('WebSite') && linked.url === `${SITE}/`) linked = { ...linked, '@id': `${SITE}/#website` };
    }
    next[key] = linked;
  }
  return next;
}

function patchSchemas(head, url, title, description, config, organization) {
  let websiteCount = 0;
  const transform = original => {
    const node = linkKnownReferences(original, config, organization);
    if (!node || typeof node !== 'object') return node;
    const kind = types(node);
    if (url === `${SITE}/` && kind.some(type => ['Organization', 'EducationalOrganization'].includes(type))
      && node.url === organization.url && node.legalName === organization.legalName && node['@id'] !== organization['@id']) return null;
    if (url === `${SITE}/` && kind.includes('WebSite') && node.url === url) {
      websiteCount += 1;
      return { ...node, '@id': `${SITE}/#website`, name: config.siteName,
        alternateName: config.alternateNames, publisher: { '@id': organization['@id'] } };
    }
    if (kind.some(type => ['WebPage', 'CollectionPage'].includes(type)) && (node.url === url || node['@id'] === url)) {
      return { ...node, name: title, description };
    }
    return node;
  };
  const next = head.replace(schemaPattern, (script, attrs, quote, raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`Invalid JSON-LD: ${url}`); }
    let patched;
    if (Array.isArray(data)) patched = data.map(transform).filter(Boolean);
    else if (data?.['@graph']) patched = { ...data, '@graph': data['@graph'].map(transform).filter(Boolean) };
    else patched = transform(data);
    if (patched === null || (Array.isArray(patched) && !patched.length)) return '';
    return JSON.stringify(patched) === JSON.stringify(data) ? script : `<script ${attrs.trim()}>${jsonLd(patched)}</script>`;
  });
  if (url === `${SITE}/` && websiteCount !== 1) throw new Error(`Expected one existing homepage WebSite, got ${websiteCount}`);
  return next;
}

export function syncEntryPageHtml(html, entry, config, organization) {
  const url = SITE + entry.route;
  const $ = load(html);
  if ($('head > title').length !== 1 || $('meta[name="description"]').length !== 1 || $('link[rel="canonical"]').length !== 1 || $('h1').length !== 1) throw new Error(`Ambiguous SEO fields: ${url}`);
  if ($('link[rel="canonical"]').attr('href') !== url) throw new Error(`Canonical mismatch: ${url}`);
  const match = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i);
  if (!match) throw new Error(`Missing head: ${url}`);
  const description = entry.description ?? $('meta[name="description"]').attr('content');
  let head = match[0].replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(entry.title)}</title>`);
  head = setMeta(head, 'description', description);
  head = setMeta(head, 'keywords', entry.keywords.join(','));
  head = patchSchemas(head, url, entry.title, description, config, organization).replace(/^[\t ]+$/gm, '');
  let next = html.slice(0, match.index) + head + html.slice(match.index + match[0].length);
  if (entry.h1 || entry.h1Parts) {
    const heading = entry.h1Parts
      ? entry.h1Parts.map((part, index) => `<span class="w${index === 1 ? ' em' : ''}">${escapeHtml(part)}</span>`).join('')
      : escapeHtml(entry.h1);
    next = next.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, (_, start, end) => start + heading + end);
  }
  return next;
}

export function inspectEntrySeo(html, entry, config, organization) {
  const $ = load(html), issues = [], url = SITE + entry.route;
  const expected = {
    'head > title': ['text', entry.title],
    'meta[name="keywords"]': ['content', entry.keywords.join(',')],
    'link[rel="canonical"]': ['href', url]
  };
  for (const [selector, [attribute, value]] of Object.entries(expected)) {
    if ($(selector).length !== 1 || (attribute === 'text' ? $(selector).text() : $(selector).attr(attribute)) !== value) issues.push(`entry SEO mismatch: ${selector}`);
  }
  const description = entry.description ?? $('meta[name="description"]').attr('content');
  for (const selector of ['meta[name="description"]']) {
    if ($(selector).length !== 1 || $(selector).attr('content') !== description) issues.push(`entry SEO mismatch: ${selector}`);
  }
  if (entry.h1 || entry.h1Parts) {
    if (normalize($('h1').text()) !== normalize(entry.h1 ?? entry.h1Parts.join(''))) issues.push('entry H1 mismatch');
  }
  const definitions = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { definitions.push(...nodes(JSON.parse($(el).text()))); } catch { issues.push('invalid JSON-LD'); }
  });
  for (const node of definitions) {
    if (types(node).some(type => ['WebPage', 'CollectionPage'].includes(type)) && (node?.url === url || node?.['@id'] === url)) {
      if (node.name !== entry.title || node.description !== description) issues.push('entry page schema metadata mismatch');
    }
  }
  if (entry.route === '/') {
    const websites = definitions.filter(node => types(node).includes('WebSite') && node?.url === url);
    const organizations = definitions.filter(node => types(node).some(type => ['Organization', 'EducationalOrganization'].includes(type)) && node?.url === url && node?.legalName === organization.legalName);
    if (websites.length !== 1 || websites[0]?.name !== config.siteName || JSON.stringify(websites[0]?.alternateName) !== JSON.stringify(config.alternateNames) || websites[0]?.['@id'] !== `${SITE}/#website` || websites[0]?.publisher?.['@id'] !== organization['@id']) issues.push('homepage WebSite identity mismatch');
    if (organizations.length !== 1 || organizations[0]?.['@id'] !== organization['@id']) issues.push('homepage duplicate organization identity');
  }
  return [...new Set(issues)];
}

export function syncEntrySeo(root, { checkOnly = false } = {}) {
  const config = readEntrySeoConfig(root);
  const organization = JSON.parse(fs.readFileSync(`${root}/content/organization.json`, 'utf8'));
  const pending = config.entries.map(entry => {
    const file = localFile(root, SITE + entry.route);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing SEO entry: ${entry.route}`);
    const before = fs.readFileSync(file, 'utf8');
    const after = syncEntryPageHtml(before, entry, config, organization);
    return { file, before, after, entry };
  });
  const issues = [];
  let updated = 0;
  for (const { file, before, after, entry } of pending) {
    if (checkOnly) issues.push(...inspectEntrySeo(before, entry, config, organization).map(issue => `${entry.route}: ${issue}`));
    else if (before !== after) { fs.writeFileSync(file, after, 'utf8'); updated += 1; }
  }
  return { checked: pending.length, updated, issues };
}
