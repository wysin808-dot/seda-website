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
    });
}

function writeArticle(article) {
  const dir = path.join(root, article.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(article), 'utf8');
}

function removeDraftArticlePage(article) {
  const dir = path.join(root, article.url);
  const rel = path.relative(root, dir);
  if (!rel || rel.startsWith('..') || rel === '.' || !article.meta.slug) return;
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function githubEditUrl(article) {
  const rel = path.relative(root, article.file).replaceAll(path.sep, '/');
  return `https://github.com/wysin808-dot/seda-website/edit/main/${encodeURIComponent(rel).replaceAll('%2F', '/')}`;
}

function renderReviewPage(articles) {
  const drafts = articles
    .filter((article) => article.meta.draft)
    .sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')));
  const published = articles.filter((article) => !article.meta.draft).length;
  const draftCards = drafts.map((article, index) => {
    const meta = article.meta;
    return `<article class="review-card" id="draft-${index + 1}">
      <div class="review-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(meta.categoryLabel || meta.category || 'SEO文章')} · ${escapeHtml(meta.date || '')}</p>
          <h2>${escapeHtml(meta.title)}</h2>
          <p>${escapeHtml(meta.description || '')}</p>
        </div>
        <div class="review-actions">
          <span class="status-pill">待审核</span>
          <a class="primary-button" href="${githubEditUrl(article)}" target="_blank" rel="noopener">在 GitHub 编辑</a>
        </div>
      </div>
      <dl class="review-meta">
        <div><dt>关键词</dt><dd>${escapeHtml(meta.keywords || '')}</dd></div>
        <div><dt>计划 URL</dt><dd><code>${escapeHtml(article.url)}</code></dd></div>
        <div><dt>文件</dt><dd><code>${escapeHtml(path.relative(root, article.file).replaceAll(path.sep, '/'))}</code></dd></div>
      </dl>
      <div class="review-body">${article.html}</div>
    </article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="robots" content="noindex,nofollow"/>
<title>SEDA 内容审核后台</title>
<link rel="stylesheet" href="/seda-site.css?v=15"/>
<style>
  body{background:#f6f7f9;color:#172033}
  .review-main{max-width:1180px;margin:0 auto;padding:32px 20px 72px}
  .review-hero{background:#fff;border:1px solid #e5e8ee;border-radius:8px;padding:28px;margin-bottom:20px}
  .review-hero h1{font-size:32px;margin:8px 0 10px}
  .review-summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
  .review-summary span,.status-pill{display:inline-flex;align-items:center;border-radius:999px;background:#fff1f1;color:#c51624;border:1px solid #f1c9cd;padding:7px 12px;font-weight:700}
  .review-summary span:nth-child(2){background:#eef5ff;color:#1d4ed8;border-color:#c9ddff}
  .review-card{background:#fff;border:1px solid #e1e5ec;border-radius:8px;margin:18px 0;padding:28px}
  .review-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:start;border-bottom:1px solid #eef0f4;padding-bottom:20px}
  .review-card h2{font-size:26px;line-height:1.28;margin:8px 0 10px}
  .review-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
  .review-meta{display:grid;gap:10px;margin:18px 0 22px}
  .review-meta div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px}
  .review-meta dt{font-weight:800;color:#5b6472}
  .review-meta dd{margin:0;color:#1f2937;overflow-wrap:anywhere}
  .review-body{max-width:820px}
  .review-body h2{font-size:24px;margin-top:30px}
  .review-body h3{font-size:19px;margin-top:24px}
  .review-body p,.review-body li{font-size:17px;line-height:1.85}
  .review-body table{width:100%;border-collapse:collapse;margin:18px 0}
  .review-body th,.review-body td{border:1px solid #e5e8ee;padding:10px;text-align:left}
  .review-empty{background:#fff;border:1px solid #e5e8ee;border-radius:8px;padding:28px}
  @media (max-width:760px){.review-card-head{grid-template-columns:1fr}.review-actions{justify-content:flex-start}.review-meta div{grid-template-columns:1fr}}
</style>
</head>
<body>
${header}
<main class="review-main">
  <section class="review-hero">
    <p class="eyebrow">内部审核</p>
    <h1>SEDA 内容审核后台</h1>
    <p>这里显示 <code>content/articles</code> 里标记为 <code>draft: true</code> 的 SEO 草稿。审核通过后，把对应文章改为 <code>draft: false</code>，再运行内容构建即可发布。</p>
    <div class="review-summary">
      <span>待审核 ${drafts.length} 篇</span>
      <span>已发布 ${published} 篇</span>
    </div>
  </section>
  ${drafts.length ? draftCards : '<section class="review-empty"><h2>暂无待审核文章</h2><p>新的 SEO 草稿会显示在这里。</p></section>'}
</main>
${footer}
</body>
</html>`;
}

function writeReviewPage(articles) {
  const dir = path.join(root, 'content-review');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderReviewPage(articles), 'utf8');
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
  if (rel.startsWith('content-review/')) return false;
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

const allArticles = loadArticles();
const articles = allArticles.filter((article) => !article.meta.draft);
const drafts = allArticles.filter((article) => article.meta.draft);
articles.forEach(writeArticle);
drafts.forEach(removeDraftArticlePage);
writeReviewPage(allArticles);
updateNewsIndex(articles);
const urlCount = updateSitemap();
console.log(`Built ${articles.length} content articles.`);
console.log(`Prepared ${drafts.length} draft articles for review.`);
console.log(`Updated sitemap.xml with ${urlCount} URLs.`);
