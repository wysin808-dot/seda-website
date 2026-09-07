import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import robotsParser from 'robots-parser';

export const SITE = 'https://sgeda.org.cn';
export function parseSitemap(xml) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid sitemap XML');
  const data = new XMLParser({ isArray: name => name === 'url' }).parse(xml);
  if (!Object.hasOwn(data, 'urlset')) throw new Error('Expected a URL sitemap');
  return (data.urlset.url || []).map(item => ({ url: String(item.loc || ''), lastmod: String(item.lastmod || '') }));
}
export function sitemapXml(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLBuilder({ ignoreAttributes: false, format: true }).build({
    urlset: { '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9', url: entries.map(item => ({ loc: item.url, ...(item.lastmod ? { lastmod: item.lastmod } : {}) })) },
  });
}
export function baiduAllowed(robots, site = SITE) {
  const parser = robotsParser(`${site}/robots.txt`, robots);
  return url => new URL(url).origin === site && parser.isAllowed(url, 'Baiduspider') === true;
}
export function localFile(root, value, base = SITE) {
  const url = new URL(value, base);
  if (url.origin !== new URL(base).origin) return null;
  let route = decodeURIComponent(url.pathname);
  if (route.endsWith('/')) route += 'index.html';
  else if (!path.extname(route)) route += '/index.html';
  const file = path.resolve(root, `.${route}`);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid local URL');
  return file;
}
export function inspectPage(html, url) {
  const $ = load(html);
  const content = $('main').length ? $('main').clone() : $('body').clone();
  content.find('script,style,header,footer,nav,.related-section,.contact-section,.related-articles').remove();
  const refs = (selector, attribute) => [...new Set($(selector).map((_, el) => {
    const raw = $(el).attr(attribute);
    if (!raw || raw.startsWith('#') || /^(data|mailto|tel|javascript):/i.test(raw)) return null;
    try { const u = new URL(raw, url); u.hash = ''; return u.origin === new URL(url).origin ? u.href : null; } catch { return null; }
  }).get())];
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"],meta[name="baiduspider"]').map((_, el) => $(el).attr('content')).get().join(',');
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const h1 = $('h1').first().text().trim();
  const issues = [];
  if (!title) issues.push('missing title');
  if (!description) issues.push('missing description');
  if (!h1) issues.push('missing h1');
  if (canonical !== url) issues.push(canonical ? 'canonical mismatch' : 'missing canonical');
  if (/noindex|\bnone\b/i.test(robots)) issues.push('noindex');
  const contentRefs = content.find('a[href],img[src]').map((_, el) => $(el).attr('href') || $(el).attr('src')).get();
  const fingerprint = createHash('sha256').update([title, description, canonical, content.text().replace(/\s+/g, ' ').trim(), ...contentRefs].join('\n')).digest('hex');
  return { url, title, description, h1, canonical, issues, fingerprint,
    modified: $('meta[property="article:modified_time"]').attr('content') || '',
    links: refs('a[href]', 'href'), images: refs('img[src]', 'src') };
}
export function assertLocalReferences(root, page) {
  return [...page.links.map(url => ({ type: 'link', url })), ...page.images.map(url => ({ type: 'image', url }))]
    .filter(ref => !new URL(ref.url).pathname.startsWith('/api/'))
    .filter(ref => !fs.existsSync(localFile(root, ref.url)))
    .map(ref => `${page.url}: missing ${ref.type} ${ref.url}`);
}
