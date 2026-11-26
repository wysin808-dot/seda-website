import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import { CATEGORIES, recordTarget } from './school-catalog.mjs';

const ORIGIN = 'https://sgeda.org.cn';
// The model module has no import-time reads/writes; pure render needs no actual JSON files.
export const DATABASE_CATEGORIES = CATEGORIES;
const INDEX_ROUTE = '/school-database/';
const text = value => typeof value === 'string' ? value.trim() : '';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const jsonScript = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char =>
  `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);

export function safeWebsite(value) {
  const raw = text(value);
  if (!/^https?:\/\//i.test(raw) || /[\u0000-\u0020\u007f"'<>`\\]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export function safeDetailUrl(value) {
  const raw = text(value);
  // Only ordinary local document paths. Never accept arbitrary schemes, query states or quoted hrefs.
  if (!/^\/(?:[A-Za-z0-9_-]+\/)+(?:index\.html)?$/.test(raw)) return '';
  return raw;
}

function validatedRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('学校记录必须为数组');
  const seen = new Set();
  for (const record of records) {
    if (!record || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id || '')) throw new Error('学校 id 必须为稳定 ASCII slug');
    if (seen.has(record.id)) throw new Error(`重复学校 id: ${record.id}`);
    if (!DATABASE_CATEGORIES.some(category => category.id === record.category)) throw new Error(`未知学校类别: ${record.category}`);
    if (!text(record.nameZh) && !text(record.nameEn)) throw new Error(`学校缺少名称: ${record.id}`);
    seen.add(record.id);
  }
  return records;
}

function categoryOf(record) {
  return DATABASE_CATEGORIES.find(category => category.id === record.category);
}
function recordUrl(record) {
  return ORIGIN + recordTarget(record);
}
function nameOf(record) {
  return text(record.nameZh) || text(record.nameEn);
}
function listItems(values) {
  return Array.isArray(values) ? values.map(text).filter(Boolean) : [];
}
function fact(label, value) {
  return `<div class="sdb-fact"><dt>${label}</dt><dd>${escapeHtml(text(value)) || '<span class="sdb-missing">尚未收录</span>'}</dd></div>`;
}
function factList(label, values) {
  const items = listItems(values);
  return `<section class="sdb-fact-section"><h3>${label}</h3>${items.length
    ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="sdb-missing">尚未收录</p>'}</section>`;
}
function renderRecord(record) {
  const category = categoryOf(record);
  const website = safeWebsite(record.website);
  const detail = safeDetailUrl(record.detailUrl);
  const en = text(record.nameEn);
  return `<article class="sdb-record" id="school-${record.id}" data-school-record="${record.id}" data-category="${record.category}" data-name-zh="${escapeHtml(text(record.nameZh))}" data-name-en="${escapeHtml(en)}" data-location="${escapeHtml(text(record.location))}" data-school-type="${escapeHtml(text(record.schoolType))}" data-curriculum="${escapeHtml(text(record.curriculum))}" tabindex="-1" aria-labelledby="school-title-${record.id}">
  <header class="sdb-record-heading"><span class="sdb-category-label">${category.label}</span><h2 id="school-title-${record.id}">${escapeHtml(nameOf(record))}</h2>${en && en !== nameOf(record) ? `<p class="sdb-name-en" lang="en">${escapeHtml(en)}</p>` : ''}</header>
  <section class="sdb-fact-section"><h3>基本资料</h3><dl class="sdb-facts">${fact('学校类型', record.schoolType)}${fact('区域 / 地址', record.location)}${fact('课程', record.curriculum)}<div class="sdb-fact sdb-fact-website"><dt>学校官网</dt><dd>${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}<span class="sdb-sr-only">（在新窗口打开）</span></a>` : '<span class="sdb-missing">尚未收录</span>'}</dd></div></dl></section>
  ${factList('专业方向', record.majorAreas)}
  ${factList('入学路径', record.admissionPaths)}
  ${detail ? `<p class="sdb-read-more"><a href="${escapeHtml(detail)}">阅读${escapeHtml(nameOf(record))}完整资料 <span aria-hidden="true">→</span></a></p>` : ''}
</article>`;
}
function schoolEntity(record) {
  const entity = { '@type': 'School', '@id': recordUrl(record), name: nameOf(record), url: recordUrl(record) };
  if (text(record.nameEn) && text(record.nameEn) !== entity.name) entity.alternateName = text(record.nameEn);
  if (text(record.location)) entity.address = text(record.location);
  if (safeWebsite(record.website)) entity.sameAs = safeWebsite(record.website);
  const description = [text(record.schoolType), text(record.curriculum)].filter(Boolean).join('；');
  if (description) entity.description = description;
  return entity;
}
function metadata(category, count) {
  const route = category?.route || INDEX_ROUTE;
  const heading = category ? `新加坡${category.label}数据库` : '新加坡学校数据库';
  const description = category
    ? `浏览已收录的${count}所新加坡${category.label}中英文名称、学校类型、区域、课程与学校官网，以及已有的专业方向和入学路径。可按校名或课程搜索，使用目录链接直接查看学校记录。`
    : `浏览新加坡小学、中学、国际学校、私立学校、初级学院、理工学院与大学的${count}条学校记录。整理已有的中英文校名、学校类型、区域、课程、官网、专业方向和入学路径，支持搜索与分类浏览。`;
  return { route, heading, title: `${heading}｜学校资料与目录 | SEDA 新加坡择校网`, description };
}

/** Pure HTML renderer. category accepts null or one of the seven category ids. */
export function renderSchoolDatabase(records, { category = null, header = '', footer = '' } = {}) {
  validatedRecords(records);
  const selectedCategory = category === null ? null : DATABASE_CATEGORIES.find(item => item.id === category);
  if (category !== null && !selectedCategory) throw new Error(`未知学校类别: ${category}`);
  const visible = selectedCategory ? records.filter(record => record.category === selectedCategory.id) : records;
  const meta = metadata(selectedCategory, visible.length);
  const canonical = ORIGIN + meta.route;
  const categories = [{ id: null, label: '全部学校', route: INDEX_ROUTE }, ...DATABASE_CATEGORIES];
  const locations = [...new Set(visible.map(record => text(record.location)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': canonical,
    url: canonical, name: meta.heading, description: meta.description, inLanguage: 'zh-CN',
    mainEntity: {
      '@type': 'ItemList', numberOfItems: visible.length,
      itemListElement: visible.map((record, index) => ({
        '@type': 'ListItem', position: index + 1, url: recordUrl(record), item: schoolEntity(record),
      })),
    },
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/seda-site.css?v=45">
<link rel="stylesheet" href="/assets/school-database.css?v=1">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="SEDA 新加坡择校网">
<meta property="og:locale" content="zh_CN">
<meta property="og:image" content="${ORIGIN}/assets/seda-wordmark.svg">
<meta property="og:image:alt" content="SEDA 新加坡择校网">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${ORIGIN}/assets/seda-wordmark.svg">
<script type="application/ld+json">${jsonScript(collection)}</script>
</head>
<body class="school-database-page">
<!-- SEDA_SCHOOL_DATABASE -->
<a class="sdb-skip-link" href="#school-database-main">跳至学校资料</a>
${header}
<main id="school-database-main" class="sdb-main" data-school-database data-page-category="${selectedCategory?.id || ''}">
  <nav class="sdb-breadcrumb" aria-label="当前位置"><a href="/">首页</a><span aria-hidden="true">/</span>${selectedCategory ? '<a href="/school-database/">学校数据库</a><span aria-hidden="true">/</span>' : ''}<span aria-current="page">${selectedCategory?.label || '学校数据库'}</span></nav>
  <div class="sdb-intro"><p class="sdb-eyebrow">SEDA · 学校目录</p><h1>${meta.heading}</h1><p class="sdb-intro-text">从校名开始，查看学校已有资料。${selectedCategory ? `本页收录${visible.length}所${selectedCategory.label}。` : `按七类学校浏览，共${visible.length}条学校记录。`}</p></div>
  <div class="sdb-toolbar" data-school-controls hidden>
    <div class="sdb-search-field"><label for="school-search">搜索学校</label><input id="school-search" type="search" placeholder="中文 / 英文校名、学校类型或课程" autocomplete="off" aria-controls="school-name-list school-records"></div>
    <div class="sdb-location-field"><label for="school-location">区域 / 地址</label><select id="school-location" aria-controls="school-name-list school-records"><option value="">全部已收录区域 / 地址</option>${locations.map(location => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join('')}</select></div>
    <button type="button" class="sdb-reset" data-school-reset>清除筛选</button>
  </div>
  <nav class="sdb-category-nav" aria-label="学校类别">${categories.map(item => `<a href="${item.route}"${item.id === category ? ' aria-current="page"' : ''}>${item.label}<span>${item.id === null ? records.length : records.filter(record => record.category === item.id).length}</span></a>`).join('')}</nav>
  <div class="sdb-results-bar"><p data-school-result-count role="status" aria-live="polite" aria-atomic="true">${visible.length} 所学校</p><p class="sdb-browser-hint">选择校名查看资料</p></div>
  <noscript><p class="sdb-nojs-note">可使用浏览器“查找”（Ctrl / Command + F）搜索中英文校名、类型或课程；下方目录链接可跳至对应学校，所有已收录资料均在本页。</p></noscript>
  <p class="sdb-hash-notice" data-school-hash-notice role="status" hidden></p>
  <div class="sdb-layout">
    <aside class="sdb-directory" aria-labelledby="school-directory-heading"><div class="sdb-directory-heading"><h2 id="school-directory-heading">学校目录</h2><span>中文 / English</span></div><ul id="school-name-list" class="sdb-school-list">${visible.map(record => `<li data-school-list-item="${record.id}"><a href="#school-${record.id}" data-school-select="${record.id}" aria-controls="school-${record.id}"><span class="sdb-list-name">${escapeHtml(nameOf(record))}</span>${text(record.nameEn) && text(record.nameEn) !== nameOf(record) ? `<span class="sdb-list-en" lang="en">${escapeHtml(text(record.nameEn))}</span>` : ''}<span class="sdb-list-category">${categoryOf(record).label}</span></a></li>`).join('')}</ul></aside>
    <div id="school-records" class="sdb-records" aria-label="学校资料"><p class="sdb-sr-only" data-school-selection-status aria-live="polite" aria-atomic="true"></p><section class="sdb-empty" data-school-empty${visible.length ? ' hidden' : ''}><h2>未找到学校</h2><p>没有符合当前条件的学校，请调整关键词或清除筛选。</p></section>${visible.map(renderRecord).join('\n')}</div>
  </div>
  <div class="sdb-contact contact-section"><p>有资料需要补充或纠正？</p><a href="/contact/">联系 SEDA <span aria-hidden="true">→</span></a></div>
</main>
${footer}
<script src="/seda-site.js?v=30" defer></script>
<script type="module" src="/assets/school-database.js?v=1"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, '');
}

/** Model loading and writes happen here only, never at module import time. */
export async function buildSchoolDatabase(root = process.cwd()) {
  const { CATEGORIES, loadCatalog, loadCatalogPolicy } = await import('./school-catalog.mjs');
  const records = await loadCatalog(root);
  const policy = await loadCatalogPolicy(root);
  for (const expected of DATABASE_CATEGORIES) {
    if (!CATEGORIES.some(item => item.id === expected.id && item.route === expected.route)) {
      throw new Error(`学校类别路由契约不一致: ${expected.id}`);
    }
  }
  if (!policy || !Array.isArray(policy.categories)) throw new Error('学校迁移策略缺少类别');
  for (const expected of DATABASE_CATEGORIES) {
    if (!policy.categories.some(item => item.id === expected.id && item.route === expected.route)) {
      throw new Error(`学校策略类别路由不一致: ${expected.id}`);
    }
  }
  const $ = load(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const sharedHeader = $('header.site-header').first();
  const sharedFooter = $('footer.site-footer').first();
  if (!sharedHeader.length || !sharedFooter.length) throw new Error('首页缺少共享 header/footer，停止生成');
  sharedHeader.find('a.active').removeClass('active').removeAttr('aria-current');
  const header = sharedHeader.prop('outerHTML');
  const footer = sharedFooter.prop('outerHTML');
  const pages = [{ id: null, route: INDEX_ROUTE }, ...DATABASE_CATEGORIES];
  // Render every page before writing any file, so validation errors cannot leave partial output.
  const outputs = pages.map(page => ({
    route: page.route,
    html: renderSchoolDatabase(records, { category: page.id, header, footer }),
    count: page.id === null ? records.length : records.filter(record => record.category === page.id).length,
  }));
  let changed = 0;
  for (const output of outputs) {
    const filename = path.join(root, output.route, 'index.html');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== output.html) {
      fs.writeFileSync(filename, output.html);
      changed++;
    }
  }
  return { records: records.length, pages: outputs.length, changed, categories: Object.fromEntries(DATABASE_CATEGORIES.map(category => [category.id, records.filter(record => record.category === category.id).length])), routes: outputs.map(({ route, count }) => ({ route, count })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildSchoolDatabase().then(stats => console.log(JSON.stringify(stats, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
