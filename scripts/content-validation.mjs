import fs from 'node:fs';
import { load } from 'cheerio';
import { SITE, localFile } from './seo-pages.mjs';
import { parseSitemap, inspectPage } from './seo-pages.mjs';
import { sourceLinks } from './editorial-policy.mjs';

// This date marks the start of the reviewed-publication workflow. Older
// published content remains stable while it is audited incrementally.
const REVIEWED_PUBLICATION_START = '2026-09-24';

export function verifyBuiltPublication(root, route) {
  const file = localFile(root, route);
  if (!file || !fs.existsSync(file)) throw new Error(`Published page missing: ${route}`);
  const url = new URL(route, SITE).href;
  const page = inspectPage(fs.readFileSync(file, 'utf8'), url);
  if (page.issues.length) throw new Error(`Published page invalid: ${route}: ${page.issues.join('; ')}`);
  const map = parseSitemap(fs.readFileSync(`${root}/sitemap.xml`, 'utf8'));
  if (!map.some(entry => entry.url === url)) throw new Error(`Published page absent from sitemap: ${route}`);
  return { scope: 'origin-build', url, status: 'verified', publicHttpStatus: null };
}

export function partitionArticles(all) {
  const published = all.filter(a => !a.meta.draft);
  const urls = new Set();
  for (const a of published) {
    if (a.meta.contentType === 'research-brief' || /\[待核实\]|\[待补充\]/.test(a.body || '')) throw new Error(`Unreviewed research brief: ${a.url}`);
    if (String(a.meta.date || '') >= REVIEWED_PUBLICATION_START) {
      if (!sourceLinks(a.body).length) throw new Error(`Recent publication lacks external sources: ${a.url}`);
      if (a.meta.reviewStatus !== 'approved' || !a.meta.reviewedBy || !a.meta.factCheckedAt) {
        throw new Error(`Recent publication lacks review evidence: ${a.url}`);
      }
    }
    if (urls.has(a.url)) throw new Error(`Duplicate published article URL: ${a.url}`);
    urls.add(a.url);
  }
  return { published, drafts: all.filter(a => a.meta.draft && !urls.has(a.url)) };
}

export function prepareArticleHtml(article, all, root, policy) {
  const $ = load(article.html, null, false);
  const { published, drafts } = partitionArticles(all);
  const publishedUrls = new Set(published.map(a => a.url));
  const draftUrls = new Set(drafts.map(a => a.url));
  const exists = route => !draftUrls.has(route) && (publishedUrls.has(route) || fs.existsSync(localFile(root, route)));
  const errors = [];
  $('a[href]').each((_, el) => {
    const node = $(el), raw = node.attr('href');
    const url = new URL(raw, SITE + article.url);
    if (url.origin !== SITE || /^(mailto|tel):/.test(raw)) return;
    const route = !url.pathname.endsWith('/') && (publishedUrls.has(url.pathname + '/') || draftUrls.has(url.pathname + '/')) ? url.pathname + '/' : url.pathname;
    if (exists(route)) {
      if (route !== url.pathname) node.attr('href', route + url.search + url.hash);
      return;
    }
    const parts = route.split('/').filter(Boolean);
    const candidate = parts.length === 2 ? `/${parts[0]}/${parts[0]}-${parts[1]}/` : '';
    const replacement = policy.aliases[route] || (publishedUrls.has(candidate) || draftUrls.has(candidate) ? candidate : '');
    if (replacement && exists(replacement)) { node.attr('href', replacement + url.search + url.hash); return; }
    if (draftUrls.has(route) || draftUrls.has(replacement) || policy.unavailableLinks.includes(route)) { node.replaceWith(node.contents()); return; }
    errors.push(`missing link ${route}`);
  });
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (/^data:/.test(src)) return;
    const file = localFile(root, src, SITE + article.url);
    if (!file || fs.existsSync(file)) return;
    if (policy.missingImages.includes(new URL(src, SITE).pathname)) { $(el).remove(); return; }
    errors.push(`missing image ${src}`);
  });
  if (errors.length && !article.meta.draft) throw new Error(`${article.file}: ${errors.join('; ')}`);
  $('p').filter((_, el) => !$(el).text().trim() && !$(el).children().length).remove();
  return $.html();
}
