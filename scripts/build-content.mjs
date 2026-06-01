import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const articleDir = path.join(root, 'content', 'articles');

const relatedByCategory = {
  wace: [
    ['WACE 课程总览', '/wace/'],
    ['WACE vs A-Level', '/wace-vs-a-level/'],
    ['WACE 申请 NUS / NTU', '/wace-nus-ntu/'],
  ],
  'o-level': [
    ['O-Level 课程总览', '/o-level/'],
    ['O-Level 申请 JC', '/o-level-jc/'],
    ['O-Level 申请 Poly', '/o-level-poly/'],
  ],
  aeis: [
    ['AEIS 考试攻略', '/aeis/'],
    ['AEIS 数学备考', '/aeis/math/'],
    ['AEIS 年龄要求', '/aeis/age-requirements/'],
  ],
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function between(html, start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a === -1 || b === -1) throw new Error(`Cannot find template block ${start} ... ${end}`);
  return html.slice(a, b + end.length);
}

const home = read(path.join(root, 'index.html'));
const header = between(home, '<header class="site-header">', '</header>');
const footer = between(home, '<footer class="site-footer">', '</footer>');

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Missing frontmatter: ${file}`);
  const meta = {};
  match[1].split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'true') meta[key] = true;
    else if (value === 'false') meta[key] = false;
    else meta[key] = value;
  });
  return { meta, body: match[2].trim() };
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inline(md) {
  return escapeHtml(md)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let list = null;
  let table = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  }

  function flushTable() {
    if (!table.length) return;
    const rows = table
      .filter((row) => !/^\s*\|?\s*-{3,}/.test(row))
      .map((row) => row.split('|').map((cell) => cell.trim()).filter(Boolean));
    if (rows.length) {
      const [head, ...body] = rows;
      out.push('<table><thead><tr>' + head.map((cell) => `<th>${inline(cell)}</th>`).join('') + '</tr></thead><tbody>' + body.map((row) => '<tr>' + row.map((cell) => `<td>${inline(cell)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    }
    table = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(); flushList(); flushTable();
      continue;
    }
    if (trimmed.includes('|') && !trimmed.startsWith('#')) {
      flushParagraph(); flushList();
      table.push(trimmed);
      continue;
    }
    flushTable();
    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') list = { type: 'ul', items: [] };
      list.items.push(bullet[1]);
      continue;
    }
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== 'ol') list = { type: 'ol', items: [] };
      list.items.push(ordered[1]);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph(); flushList(); flushTable();
  return out.join('\n');
}

function firstH2(body) {
  return (body.match(/^##\s+(.+)$/m)?.[1] || '').trim();
}

function makeUrl(meta) {
  const slug = meta.slug || meta.title;
  return `/${meta.category || 'guides'}/${slug}/`.replace(/\/+/g, '/');
}

function renderArticle(article) {
  const { meta, html, url } = article;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description || '');
  const keywords = escapeHtml(meta.keywords || meta.tags || '');
  const categoryLabel = escapeHtml(meta.categoryLabel || meta.category || '指南');
  const related = relatedByCategory[meta.category] || [
    ['新加坡教育体系总览', '/singapore-education/'],
    ['留学指南', '/guides/'],
    ['学校数据库', '/school-database/'],
  ];
  const relatedHtml = related.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
  const articleSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description || '',
    datePublished: meta.date,
    dateModified: meta.updated || meta.date,
    author: { '@type': 'Organization', name: 'SEDA 新加坡国际教育平台' },
    publisher: { '@type': 'Organization', name: 'SEDA 新加坡国际教育平台', url: `${domain}/` },
    mainEntityOfPage: `${domain}${url}`,
    inLanguage: 'zh-CN',
  });
  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: `${domain}/` },
      { '@type': 'ListItem', position: 2, name: categoryLabel, item: `${domain}/${meta.category || 'guides'}/` },
      { '@type': 'ListItem', position: 3, name: meta.title },
    ],
  });
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${title} | SEDA</title>
<meta name="description" content="${description}"/>
<meta name="keywords" content="${keywords}"/>
<link rel="canonical" href="${domain}${url}"/>
<link rel="stylesheet" href="/seda-site.css?v=15"/>
<script type="application/ld+json">${articleSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>
</head>
<body>
${header}
<main>
  <div class="content-hero">
    <nav class="breadcrumb" aria-label="面包屑"><a href="/">首页</a> <span class="bc-sep">›</span> <a href="/${meta.category || 'guides'}/">${categoryLabel}</a> <span class="bc-sep">›</span> <span>${title}</span></nav>
    <p class="eyebrow">${categoryLabel}</p>
    <h1>${title}</h1>
    <p class="hero-subtitle">${description}</p>
  </div>
  <article class="content-body">
    ${html}
    <section class="related-section">
      <h2>继续阅读</h2>
      <div class="quick-links">${relatedHtml}</div>
    </section>
    <section class="contact-section" id="contact" aria-labelledby="contact-title">
      <div>
        <p class="eyebrow">免费咨询</p>
        <h2 id="contact-title">想判断这条路径是否适合孩子？</h2>
        <p>告诉我们学生年级、英文基础和目标学校，SEDA 顾问会帮你梳理更适合的升学路线。</p>
      </div>
      <form class="lead-form">
        <label><span>学生当前年级</span><input type="text" name="grade" placeholder="例如：国内初三 / 高一" /></label>
        <label><span>目标方向</span><input type="text" name="target" placeholder="${categoryLabel}" /></label>
        <label><span>联系方式</span><input type="text" name="contact" placeholder="微信 / WhatsApp / 手机" /></label>
        <button class="primary-button" type="submit">提交咨询</button>
      </form>
    </section>
  </article>
</main>
${footer}
<script src="/seda-site.js?v=16"></script>
</body>
</html>`;
}

function loadArticles() {
  if (!fs.existsSync(articleDir)) return [];
  return fs.readdirSync(articleDir)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => {
      const full = path.join(articleDir, file);
      const parsed = parseFrontmatter(read(full), full);
      const url = makeUrl(parsed.meta);
      return {
        file: full,
        meta: parsed.meta,
        body: parsed.body,
        html: markdownToHtml(parsed.body),
        url,
        summary: firstH2(parsed.body) || parsed.meta.description || '',
      };
    })
    .filter((article) => !article.meta.draft);
}

function writeArticle(article) {
  const dir = path.join(root, article.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(article), 'utf8');
}

function updateNewsIndex(articles) {
  const file = path.join(root, 'news', 'index.html');
  let html = read(file);
  const start = '<!-- GENERATED_ARTICLES_START -->';
  const end = '<!-- GENERATED_ARTICLES_END -->';
  const cards = articles
    .sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')))
    .slice(0, 24)
    .map((article) => `          <article class="article-card">
            <a href="${article.url}">
              <span class="tag">${escapeHtml(article.meta.categoryLabel || article.meta.category || 'SEO文章')}</span>
              <h3>${escapeHtml(article.meta.title)}</h3>
              <p>${escapeHtml(article.meta.description || article.summary)}</p>
              <time>${escapeHtml(article.meta.date || '')}</time>
            </a>
          </article>`)
    .join('\n');
  const block = `${start}\n${cards}\n          ${end}`;
  if (html.includes(start) && html.includes(end)) {
    html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    html = html.replace('<div class="article-grid">', `<div class="article-grid">\n          ${block}`);
  }
  fs.writeFileSync(file, html, 'utf8');
}

function isSitemapPage(file) {
  const rel = path.relative(root, file);
  if (rel.includes('/api/') || rel.startsWith('content/') || rel.startsWith('scripts/')) return false;
  if (['googlec871b41fdb15d90a.html'].includes(rel)) return false;
  return rel.endsWith('.html');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'content' || entry.name === 'scripts') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function updateSitemap() {
  const urls = walk(root)
    .filter(isSitemapPage)
    .map((file) => {
      let rel = path.relative(root, file).replaceAll(path.sep, '/');
      if (rel === 'index.html') rel = '';
      else if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
      const url = `${domain}/${rel}`;
      const stat = fs.statSync(file);
      const lastmod = stat.mtime.toISOString().slice(0, 10);
      const trimmed = rel.endsWith('/') ? rel.slice(0, -1) : rel;
      const priority = rel === '' ? '1.0' : trimmed.includes('/') ? '0.6' : '0.8';
      const changefreq = rel === '' || rel === 'news/' ? 'daily' : 'weekly';
      return { url, lastmod, priority, changefreq };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((entry) => `  <url>\n    <loc>${entry.url}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, 'sitemap.xml'), body, 'utf8');
  return urls.length;
}

const articles = loadArticles();
articles.forEach(writeArticle);
updateNewsIndex(articles);
const urlCount = updateSitemap();
console.log(`Built ${articles.length} content articles.`);
console.log(`Updated sitemap.xml with ${urlCount} URLs.`);
