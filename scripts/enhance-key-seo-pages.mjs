import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const headMarkerStart = '<!-- SEDA_KEY_SEO_START -->';
const headMarkerEnd = '<!-- SEDA_KEY_SEO_END -->';
const bodyMarkerStart = '<!-- SEDA_GEO_BODY_START -->';
const bodyMarkerEnd = '<!-- SEDA_GEO_BODY_END -->';

// Reviewed pages with their own schemas are deliberately excluded. There is no
// separate copy bank: title, description, links and FAQ come from the page itself.
const routes = ['wace-vs-a-level','o-level-jc','o-level-poly','a-level','ib','ap','foundation','pathway','international-school','school-database'];
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const escapeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

function stripExisting(html) {
  return html
    .replace(new RegExp(`${headMarkerStart}[\\s\\S]*?${headMarkerEnd}\\n?`, 'g'), '')
    .replace(new RegExp(`${bodyMarkerStart}[\\s\\S]*?${bodyMarkerEnd}\\n?`, 'g'), '');
}

export function enhancePageHtml(html, url) {
  const clean = stripExisting(html);
  const $ = load(clean);
  const title = normalize($('head > title').text());
  const description = $('meta[name="description"]').attr('content') || '';
  const visibleFaqs = [];
  const seen = new Set();
  $('.faq-section details, .faq-item').each((_, el) => {
    const item = $(el);
    const question = item.find('summary,.faq-question,h3,h4').first();
    const answer = item.find('.faq-answer').first();
    const copy = answer.length ? answer.clone() : item.clone();
    copy.find('summary,.faq-question,h3,h4,button,script,style').remove();
    const q = normalize(question.text()), a = normalize(copy.text());
    if (q && a && !seen.has(q)) { seen.add(q); visibleFaqs.push({ q, a }); }
  });
  const hasExistingFaq = $('script[type="application/ld+json"]').toArray().some(el => {
    try { const data = JSON.parse($(el).text()); return (data['@graph'] || [data]).some(n => n['@type'] === 'FAQPage'); }
    catch { return false; }
  });
  const webPage = {
    '@context':'https://schema.org', '@type':'WebPage', name:title, description, url,
    inLanguage:'zh-CN',
    isPartOf:{'@type':'WebSite',name:'SEDA 新加坡择校网',url:domain+'/'},
    publisher:{'@type':'Organization',name:'SEDA 新加坡择校网',url:domain+'/'},
  };
  const schemas = [webPage];
  if (!hasExistingFaq && visibleFaqs.length) schemas.push({
    '@context':'https://schema.org','@type':'FAQPage',
    mainEntity: visibleFaqs.map(item => ({
      '@type':'Question',name:item.q,
      acceptedAnswer:{'@type':'Answer',text:item.a},
    })),
  });
  const block = `${headMarkerStart}\n${schemas.map(n => `<script type="application/ld+json">${escapeJson(n)}</script>`).join('\n')}\n${headMarkerEnd}`;
  if (!clean.includes('</head>')) throw new Error(`Missing </head> in ${url}`);
  return clean.replace('</head>', block+'\n</head>');
}

export function enhanceKeySeoPages() {
  let count = 0;
  for (const route of routes) {
    const file = path.join(root,route,'index.html');
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file,'utf8');
    const next = enhancePageHtml(before,`${domain}/${route}/`);
    if (next !== before) fs.writeFileSync(file,next,'utf8');
    count += 1;
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Enhanced ${enhanceKeySeoPages()} key SEO pages.`);
}
