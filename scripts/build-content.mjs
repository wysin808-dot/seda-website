import fs from 'node:fs';
import path from 'node:path';
import { buildSchoolPages } from './build-school-pages.mjs';
import { enhanceKeySeoPages } from './enhance-key-seo-pages.mjs';
import { optimizeArticle } from './seo-optimizer.mjs';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const defaultGoogleAnalyticsId = 'G-38WFES3WTH';
const buildDate = new Date().toISOString().slice(0, 10);
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

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function inline(md) {
  return escapeHtml(md)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
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

function stripInlineMarkdown(value = '') {
  return String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFaqItems(markdown = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  const items = [];
  let inFaq = false;
  let current = null;

  function flushCurrent() {
    if (!current) return;
    const answer = stripInlineMarkdown(current.answer.join(' '));
    if (current.question && answer) {
      items.push({ question: current.question, answer });
    }
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushCurrent();
      inFaq = /FAQ|常见问题|常见问答|家长常问/i.test(h2[1]);
      continue;
    }
    if (!inFaq) continue;
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushCurrent();
      current = { question: stripInlineMarkdown(h3[1]), answer: [] };
      continue;
    }
    if (current && line && !line.startsWith('|')) current.answer.push(line);
  }
  flushCurrent();
  return items.slice(0, 8);
}

function makeUrl(meta) {
  const slug = meta.slug || meta.title;
  return `/${meta.category || 'guides'}/${slug}/`.replace(/\/+/g, '/');
}

function articleDateValue(article) {
  return String(article.meta.publishedAt || article.meta.updated || article.meta.date || '');
}

function sortedArticles(articles) {
  return [...articles].sort((a, b) => articleDateValue(b).localeCompare(articleDateValue(a)));
}

function findRelatedArticles(article, articles, limit = 6) {
  const sameCategory = sortedArticles(articles)
    .filter((item) => item.url !== article.url && item.meta.category === article.meta.category);
  const fallback = sortedArticles(articles)
    .filter((item) => item.url !== article.url && item.meta.category !== article.meta.category);
  return [...sameCategory, ...fallback].slice(0, limit);
}

function extractKeyTakeaways(markdown = '', description = '') {
  const lines = String(markdown || '').split(/\r?\n/);
  const takeaways = [];
  let inConclusion = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      inConclusion = /结论|先看结论|重点|家长|建议/i.test(h2[1]);
      continue;
    }
    if (!inConclusion) continue;
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) takeaways.push(stripInlineMarkdown(bullet[1]));
    else if (line && !line.startsWith('#') && !line.includes('|')) takeaways.push(stripInlineMarkdown(line));
    if (takeaways.length >= 4) break;
  }

  if (!takeaways.length && description) takeaways.push(stripInlineMarkdown(description));
  return takeaways.filter(Boolean).slice(0, 4);
}

function renderGeoSummary(article, faqItems) {
  const { meta } = article;
  const takeaways = extractKeyTakeaways(article.body, meta.description);
  const questions = faqItems.slice(0, 3).map((item) => item.question);
  const list = [
    `主题：${meta.title}`,
    `适合人群：中国学生与家长，正在了解${meta.categoryLabel || meta.category || '新加坡升学'}。`,
    `核心结论：${takeaways[0] || meta.description || meta.title}`,
    questions.length ? `常见追问：${questions.join('；')}` : '',
  ].filter(Boolean);
  return `<section class="geo-summary" aria-labelledby="geo-summary-title">
      <p class="eyebrow">本文要点</p>
      <h2 id="geo-summary-title">快速了解本文要点</h2>
      <ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>`;
}

function renderDynamicRelated(article, articles) {
  const relatedArticles = findRelatedArticles(article, articles, 6);
  if (!relatedArticles.length) return '';
  return `<section class="related-section">
      <h2>相关阅读</h2>
      <div class="related-article-grid">
        ${relatedArticles.map((item) => `<a href="${item.url}">
          <span>${escapeHtml(item.meta.categoryLabel || item.meta.category || '指南')}</span>
          <strong>${escapeHtml(item.meta.title)}</strong>
          <em>${escapeHtml(item.meta.description || item.summary || '')}</em>
        </a>`).join('\n        ')}
      </div>
    </section>`;
}

function renderArticle(article, articles) {
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
  const faqItems = extractFaqItems(article.body);
  const articleSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description || '',
    keywords: meta.keywords || meta.tags || '',
    datePublished: meta.date,
    dateModified: meta.updated || meta.date,
    author: { '@type': 'Organization', name: 'SEDA 新加坡择校网' },
    publisher: {
      '@type': 'Organization',
      name: 'SEDA 新加坡择校网',
      legalName: 'Singapore Educational Development Association',
      alternateName: ['新加坡教育发展协会', 'SEDA'],
      url: `${domain}/`,
      logo: `${domain}/assets/seda-wordmark.svg`,
      email: 'admin@seda.org.sg',
      telephone: '+65 8084 7715',
      sameAs: ['https://baike.baidu.com/item/%E6%96%B0%E5%8A%A0%E5%9D%A1%E6%95%99%E8%82%B2%E5%8F%91%E5%B1%95%E5%8D%8F%E4%BC%9A'],
    },
    mainEntityOfPage: `${domain}${url}`,
    inLanguage: 'zh-CN',
    articleSection: meta.categoryLabel || meta.category || '新加坡升学指南',
    about: String(meta.tags || meta.keywords || meta.categoryLabel || '').split(',').map((name) => name.trim()).filter(Boolean).slice(0, 8),
  });
  const breadcrumbSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: `${domain}/` },
      { '@type': 'ListItem', position: 2, name: categoryLabel, item: `${domain}/${meta.category || 'guides'}/` },
      { '@type': 'ListItem', position: 3, name: meta.title },
    ],
  });
  const webPageSchema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.title,
    description: meta.description || '',
    url: `${domain}${url}`,
    datePublished: meta.date,
    dateModified: meta.updated || meta.publishedAt || meta.date || buildDate,
    isPartOf: {
      '@type': 'WebSite',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
    inLanguage: 'zh-CN',
    primaryImageOfPage: `${domain}/assets/hero-mbs-day3.jpg`,
    mainEntity: {
      '@type': 'Article',
      headline: meta.title,
      url: `${domain}${url}`,
    },
  });
  const faqSchema = faqItems.length ? jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }) : '';
  const dynamicRelated = renderDynamicRelated(article, articles);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${title} | SEDA 新加坡择校网</title>
<meta name="description" content="${description}"/>
<meta name="keywords" content="${keywords}"/>
<link rel="canonical" href="${domain}${url}"/>
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="${domain}/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v=36"/>
<script type="application/ld+json">${articleSchema}</script>
<script type="application/ld+json">${webPageSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>
${faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : ''}
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
    ${renderGeoSummary(article, faqItems)}
    ${html}
    <section class="related-section">
      <h2>继续阅读</h2>
      <div class="quick-links">${relatedHtml}</div>
    </section>
    ${dynamicRelated}
    <section class="contact-section" id="contact" aria-labelledby="contact-title">
      <div>
        <p class="eyebrow">免费咨询</p>
        <h2 id="contact-title">想判断这条路径是否适合孩子？</h2>
        <p>告诉我们学生年级、英文基础和目标学校，SEDA 顾问会帮你梳理更适合的升学路线。</p>
      </div>
      <div class="contact-action-stack">
        <div class="seda-wechat-card">
          <div class="seda-wechat-head">
            <div><strong>新加坡择校顾问 Amy</strong><span>扫码添加，获取免费择校方案</span></div>
            <button type="button" class="seda-copy-wechat" data-wechat="SEDAGUIDE">复制微信号</button>
          </div>
          <div class="seda-wechat-body">
            <img class="seda-wechat-qr" src="/assets/wechat-amy-seda-guide.jpg" alt="新加坡择校顾问Amy微信二维码" loading="lazy" decoding="async">
            <div class="seda-wechat-info">
              <p class="seda-wechat-id">微信号：<b>SEDAGUIDE</b></p>
              <ul><li>国际学校推荐</li><li>AEIS 规划</li><li>WACE 课程规划</li><li>学费预算分析</li></ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  </article>
</main>
${footer}
<script src="/seda-site.js?v=29"></script>
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
        optimization: optimizeArticle({ meta: parsed.meta, body: parsed.body }),
      };
    });
}

function writeArticle(article) {
  const dir = path.join(root, article.url);
  const outFile = path.join(dir, 'index.html');
  // SEDA_CUSTOM_PAGE protection: if the existing file contains this marker,
  // it is a hand-built custom page and must NOT be overwritten by the build.
  if (fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').includes('<!-- SEDA_CUSTOM_PAGE -->')) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outFile, renderArticle(article, articles), 'utf8');
}

function removeDraftArticlePage(article) {
  const dir = path.join(root, article.url);
  const rel = path.relative(root, dir);
  if (!rel || rel.startsWith('..') || rel === '.' || !article.meta.slug) return;
  if (fs.existsSync(dir)) {
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
    const optimization = article.optimization || optimizeArticle({ meta, body: article.body });
    const relFile = path.relative(root, article.file).replaceAll(path.sep, '/');
    const reviewStatus = meta.reviewStatus === 'needs_revision' ? '需修改' : '待审核';
    const note = meta.reviewNote ? `\n        <div><dt>审核备注</dt><dd>${escapeHtml(meta.reviewNote)}</dd></div>` : '';
    const scoreClass = optimization.level === 'error' ? 'error' : optimization.level === 'warning' ? 'warning' : 'pass';
    const scoreLabel = optimization.level === 'error' ? '需修复' : optimization.level === 'warning' ? '可优化' : '通过';
    const imagePlan = optimization.imagePlan || {};
    const suggestions = [...(optimization.suggestions || [])].slice(0, 5);
    return `<article class="review-card" id="draft-${index + 1}">
      <div class="review-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(meta.categoryLabel || meta.category || 'SEO文章')} · ${escapeHtml(meta.date || '')}</p>
          <h2>${escapeHtml(meta.title)}</h2>
          <p>${escapeHtml(meta.description || '')}</p>
        </div>
        <div class="review-actions">
          <span class="status-pill">${reviewStatus}</span>
          <button class="primary-button review-action" type="button" data-action="approve" data-file="${escapeHtml(relFile)}">通过发布</button>
          <button class="secondary-button review-action" type="button" data-action="revise" data-file="${escapeHtml(relFile)}">退回修改</button>
          <button class="danger-button review-action" type="button" data-action="archive" data-file="${escapeHtml(relFile)}">归档删除</button>
          <a class="primary-button" href="${githubEditUrl(article)}" target="_blank" rel="noopener">在 GitHub 编辑</a>
        </div>
      </div>
      <dl class="review-meta">
        <div><dt>关键词</dt><dd>${escapeHtml(meta.keywords || '')}</dd></div>
        <div><dt>计划 URL</dt><dd><code>${escapeHtml(article.url)}</code></dd></div>
        <div><dt>文件</dt><dd><code>${escapeHtml(relFile)}</code></dd></div>${note}
      </dl>
      <section class="review-optimization" aria-label="SEO 优化检查">
        <div class="review-score ${scoreClass}">
          <strong>${optimization.score}/100</strong>
          <span>${scoreLabel}${optimization.recommendedPublish ? ' · 可发布' : ' · 建议先优化'}</span>
        </div>
        <div class="review-check-grid">
          <div><strong>${optimization.metrics?.length || 0}</strong><span>正文约字数</span></div>
          <div><strong>${optimization.metrics?.h2Count || 0}</strong><span>H2</span></div>
          <div><strong>${optimization.metrics?.faqCount || 0}</strong><span>FAQ</span></div>
          <div><strong>${optimization.metrics?.internalLinkCount || 0}</strong><span>内链</span></div>
          <div><strong>${optimization.metrics?.imageCount || 0}</strong><span>图片</span></div>
        </div>
        <div class="review-image-plan">
          <strong>配图建议</strong>
          <p>首图文件：<code>${escapeHtml(imagePlan.heroFilename || meta.imageHero || '')}</code></p>
          <p>Alt：${escapeHtml(imagePlan.heroAlt || meta.imageAlt || '')}</p>
          <p>信息图：${escapeHtml(imagePlan.infographicAlt || meta.infographicSuggestion || '')}</p>
        </div>
        ${suggestions.length ? `<ul class="review-suggestions">${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="review-good">当前 SEO 基础项较完整。</p>'}
      </section>
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
<link rel="stylesheet" href="/seda-site.css?v=36"/>
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
  .review-actions button{border:0;cursor:pointer}
  .review-actions button:disabled{opacity:.62;cursor:not-allowed}
  .secondary-button{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#eef2f7;color:#263142;padding:10px 16px;font-weight:800;text-decoration:none}
  .danger-button{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#fff1f1;color:#b91c1c;padding:10px 16px;font-weight:800;text-decoration:none}
  .review-toast{position:fixed;right:18px;bottom:18px;z-index:50;max-width:360px;border-radius:8px;background:#172033;color:#fff;padding:13px 16px;box-shadow:0 16px 40px rgba(23,32,51,.2);font-weight:700}
  .review-meta{display:grid;gap:10px;margin:18px 0 22px}
  .review-meta div{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px}
  .review-meta dt{font-weight:800;color:#5b6472}
  .review-meta dd{margin:0;color:#1f2937;overflow-wrap:anywhere}
  .review-optimization{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px;margin:18px 0 24px;padding:16px;border:1px solid #eef0f4;border-radius:8px;background:#fafbfc}
  .review-score{display:flex;flex-direction:column;justify-content:center;border-radius:8px;padding:14px;background:#eef2f7;color:#344054}
  .review-score strong{font-size:30px;line-height:1}
  .review-score span{margin-top:8px;font-weight:900}
  .review-score.pass{background:#ecfdf3;color:#027a48}
  .review-score.warning{background:#fff8e6;color:#9a6400}
  .review-score.error{background:#fff1f1;color:#b91c1c}
  .review-check-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .review-check-grid div{border:1px solid #e5e8ee;border-radius:8px;background:#fff;padding:10px}
  .review-check-grid strong{display:block;font-size:20px}
  .review-check-grid span{display:block;margin-top:4px;color:#667085;font-size:12px;font-weight:800}
  .review-image-plan{grid-column:2;margin-top:-2px;color:#344054;font-size:14px;line-height:1.65}
  .review-image-plan p{margin:4px 0}
  .review-suggestions{grid-column:1 / -1;margin:0;padding-left:18px;color:#344054;line-height:1.7}
  .review-good{grid-column:1 / -1;margin:0;color:#027a48;font-weight:800}
  .review-body{max-width:820px}
  .review-body h2{font-size:24px;margin-top:30px}
  .review-body h3{font-size:19px;margin-top:24px}
  .review-body p,.review-body li{font-size:17px;line-height:1.85}
  .review-body table{width:100%;border-collapse:collapse;margin:18px 0}
  .review-body th,.review-body td{border:1px solid #e5e8ee;padding:10px;text-align:left}
  .review-empty{background:#fff;border:1px solid #e5e8ee;border-radius:8px;padding:28px}
  @media (max-width:760px){.review-card-head,.review-optimization{grid-template-columns:1fr}.review-actions{justify-content:flex-start}.review-meta div{grid-template-columns:1fr}.review-image-plan{grid-column:auto}.review-check-grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
${header}
<main class="review-main">
  <section class="review-hero">
    <p class="eyebrow">内部审核</p>
    <h1>SEDA 内容审核后台</h1>
    <p>这里显示 <code>content/articles</code> 里标记为 <code>draft: true</code> 的 SEO 草稿。点击“通过发布”后，系统会自动发布文章并更新 sitemap；点击“退回修改”可留下修改备注。</p>
    <div class="review-summary">
      <span>待审核 ${drafts.length} 篇</span>
      <span>已发布 ${published} 篇</span>
    </div>
  </section>
  ${drafts.length ? draftCards : '<section class="review-empty"><h2>暂无待审核文章</h2><p>新的 SEO 草稿会显示在这里。</p></section>'}
</main>
${footer}
<script>
(() => {
  const toast = (message) => {
    const old = document.querySelector('.review-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'review-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  };
  const tokenKey = 'sedaReviewToken';
  async function submitAction(button) {
    let token = localStorage.getItem(tokenKey) || '';
    if (!token) {
      token = prompt('请输入内容审核口令');
      if (!token) return;
      localStorage.setItem(tokenKey, token);
    }
    const action = button.dataset.action;
    const file = button.dataset.file;
    let note = '';
    if (action === 'revise') note = prompt('请输入退回修改备注（可留空）') || '';
    if (action === 'archive' && !confirm('确认归档删除这篇草稿？文章会从审核列表移走。')) return;
    button.disabled = true;
    button.textContent = '处理中...';
    try {
      const res = await fetch('/api/content-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, file, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) localStorage.removeItem(tokenKey);
        throw new Error(data.error || '操作失败');
      }
      toast(action === 'approve' ? '已发布，页面即将刷新' : action === 'archive' ? '已归档删除，页面即将刷新' : '已标记为需修改，页面即将刷新');
      setTimeout(() => location.reload(), 1200);
    } catch (error) {
      toast(error.message || '操作失败');
      button.disabled = false;
      button.textContent = action === 'approve' ? '通过发布' : action === 'archive' ? '归档删除' : '退回修改';
    }
  }
  document.querySelectorAll('.review-action').forEach((button) => {
    button.addEventListener('click', () => submitAction(button));
  });
})();
</script>
</body>
</html>`;
}

function writeReviewPage(articles) {
  const dir = path.join(root, 'content-review');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderReviewPage(articles), 'utf8');
}

function renderArticleCards(articles, limit) {
  return articles
    .sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')))
    .slice(0, limit)
    .map((article) => `          <article class="article-card">
            <a href="${article.url}">
              <span class="tag">${escapeHtml(article.meta.categoryLabel || article.meta.category || 'SEO文章')}</span>
              <h3>${escapeHtml(article.meta.title)}</h3>
              <p>${escapeHtml(article.meta.description || article.summary)}</p>
              <time>${escapeHtml(article.meta.date || '')}</time>
            </a>
          </article>`)
    .join('\n');
}

function updateNewsIndex(articles) {
  const file = path.join(root, 'news', 'index.html');
  let html = read(file);
  const start = '<!-- GENERATED_ARTICLES_START -->';
  const end = '<!-- GENERATED_ARTICLES_END -->';
  const cards = renderArticleCards(articles, 24);
  const block = `${start}\n${cards}\n          ${end}`;
  if (html.includes(start) && html.includes(end)) {
    html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    html = html.replace('<div class="article-grid">', `<div class="article-grid">\n          ${block}`);
  }
  fs.writeFileSync(file, html, 'utf8');
}

function updateHomeLatestArticles(articles) {
  const file = path.join(root, 'index.html');
  let html = read(file);
  const start = '<!-- HOME_LATEST_ARTICLES_START -->';
  const end = '<!-- HOME_LATEST_ARTICLES_END -->';
  if (!html.includes(start) || !html.includes(end)) return;
  const cards = renderArticleCards(articles, 6);
  const block = `${start}\n${cards || `          <article class="article-card">
            <a href="/news/">
              <span class="tag">SEO文章</span>
              <h3>最新文章正在更新</h3>
              <p>每天发布的新加坡升学攻略会显示在这里。</p>
            </a>
          </article>`}\n          ${end}`;
  html = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  fs.writeFileSync(file, html, 'utf8');
}

function renderFeed(articles) {
  const items = sortedArticles(articles).slice(0, 50).map((article) => {
    const published = new Date(article.meta.publishedAt || article.meta.date || Date.now()).toUTCString();
    const description = article.meta.description || article.summary || '';
    return `  <item>
    <title>${escapeXml(article.meta.title)}</title>
    <link>${domain}${article.url}</link>
    <guid isPermaLink="true">${domain}${article.url}</guid>
    <pubDate>${escapeXml(published)}</pubDate>
    <category>${escapeXml(article.meta.categoryLabel || article.meta.category || '新加坡升学')}</category>
    <description>${escapeXml(description)}</description>
  </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>SEDA 新加坡择校网最新文章</title>
  <link>${domain}/news/</link>
  <description>SEDA 新加坡择校网发布的新加坡升学、WACE、O-Level、AEIS、国际学校与留学指南文章。</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`;
}

function writeFeeds(articles) {
  const feed = renderFeed(articles);
  fs.writeFileSync(path.join(root, 'feed.xml'), feed, 'utf8');
  fs.writeFileSync(path.join(root, 'rss.xml'), feed, 'utf8');
}

function updateLlms(articles) {
  const latest = sortedArticles(articles).slice(0, 20)
    .map((article) => `- [${article.meta.title}](${article.url}): ${article.meta.description || article.summary || ''}`)
    .join('\n');
  const content = `# SEDA 新加坡择校网

> 面向中国学生和家长的新加坡国际教育、政府学校、升学路径与选校资讯平台。

## Summary

SEDA 新加坡择校网提供中文的新加坡教育信息，重点覆盖 WACE、O-Level、A-Level、AEIS、IB、政府小学、政府中学、初级学院、理工学院、国际学校、私立学校、公立大学申请与留学指南。网站目标是帮助中国家庭理解不同课程体系、入学考试、学校类型和升学路径，并提供可咨询的选校与申请入口。

## Core Topics

- [WACE 西澳课程](/wace/): 中国学生在新加坡读 WACE 的课程体系、ATAR、选课和大学申请指南。
- [WACE vs A-Level](/wace-vs-a-level/): 对比 WACE 与 A-Level 的难度、适配学生、申请方向和升学风险。
- [WACE 申请 NUS / NTU](/wace-nus-ntu/): WACE 成绩申请新加坡国立大学和南洋理工大学的路径说明。
- [O-Level 课程](/o-level/): 新加坡 O-Level 的考试体系、科目、升学方向和国际学生准备方式。
- [O-Level 申请 JC](/o-level-jc/): O-Level 成绩进入新加坡初级学院的路径和注意事项。
- [O-Level 申请 Poly](/o-level-poly/): O-Level 进入新加坡理工学院的路径、专业选择和申请建议。
- [AEIS 考试](/aeis/): 国际学生进入新加坡政府中小学的 AEIS 考试说明。
- [新加坡 A-Level](/a-level/): 新加坡本地 A-Level（剑桥-SEAB 联办）与大学申请路径说明。
- [国际 A-Level](/international-alevel/): 剑桥国际 A-Level（CAIE）的体系、与新加坡 A-Level 的区别和大学申请路径。
- [IB 课程](/ib/): IB 课程体系、适合学生和升学路径。

## Latest SEO Articles

${latest || '- 最新 SEO 文章正在更新。'}

## School Databases

- [学校数据库总览](/school-database/): 新加坡学校数据库入口。
- [政府小学数据库](/primary-schools/): 新加坡政府小学信息。
- [政府中学数据库](/secondary-schools/): 新加坡政府中学信息。
- [JC 初级学院](/jc/): 新加坡初级学院介绍。
- [Poly 理工学院](/poly/): 新加坡五所理工学院目录与申请路径。
- [Poly 专业 ELR2B2 数据库](/poly/courses/): 195 个理工学院 Diploma 专业的 ELR2B2 截分（O-Level 升 Poly）可筛选数据库。
- [国际学校](/international-school/): 新加坡国际学校与课程体系。
- [私立学校](/private-schools/): 新加坡私立学校与升学路径。

## University Pathways

- [新加坡公立大学总览](/university/): NUS、NTU、SMU、SUTD、SIT、SUSS 六所公立大学 + UAS 艺术大学目录，含预估录取分。
- [大学专业录取分数据库](/university/degrees/): 137 个本科专业的 IGP 录取分（A-Level / 理工 GPA / 预估 ATAR）可筛选数据库。
- [新加坡私立大学](/private-university/): 10 所主流私立大学（SIM、Kaplan、PSB、JCU、MDIS、Curtin、LSBF、Amity、SHRM、TMC）总览，含合作大学、学费与中留服认证。
- [私立大学专业数据库](/private-university/#database): 10 所私立大学 273 个本科 / 硕士 / 文凭专业可筛选数据库（按学校、方向、层级、合作大学），已并入私立大学总览页。
- [NUS 新加坡国立大学](/university/nus/): NUS 完整指南——学科实力、录取路径（含高考）、学费、就业。
- [NTU 南洋理工大学](/university/ntu/): NTU 完整指南——材料/工程强项、录取路径、学费、就业。
- [SMU 新加坡管理大学](/university/smu/): SMU 完整指南——商科/研讨式教学、录取路径、学费。
- [SUTD 新加坡科技设计大学](/university/sutd/): SUTD 完整指南——MIT 合作、跨学科设计、整体评估录取。
- [SIT 新加坡理工大学](/university/sit/): SIT 完整指南——应用型、IWSP 带薪实习、海外联合学位、能力本位录取。
- [SUSS 新跃社科大学](/university/suss/): SUSS 完整指南——社会科学见长、多轮评估录取（笔试+面试）。
- [UAS 新加坡艺术大学](/university/uas/): UAS 指南——作品集/试镜录取、艺术与设计专业方向。
- [香港升学](/hk-university/): 香港高校申请路径。
- [澳洲升学](/au-university/): 澳洲大学与 WACE/ATAR 申请路径。
- [英国升学](/uk-university/): 英国大学申请路径。

## Guides for Parents

- [留学指南](/guides/): 面向家长的新加坡留学实用指南。
- [学生准证](/guides/student-pass/): 新加坡学生准证申请说明。
- [留学费用](/guides/cost/): 新加坡留学费用结构。
- [住宿方案](/guides/accommodation/): 学生住宿选择。
- [陪读准证](/guides/dependent-pass/): 家长陪读政策说明。
- [家长 FAQ](/guides/parents-faq/): 家长常见问题。

## AI Tools

- [AI 升学工具](/tools/): SEDA 的升学规划、大学匹配、Poly 匹配和 AEIS 年级测算工具入口。
- [AI 大学匹配](/tools/university-matcher.html): 根据成绩和目标匹配新加坡公立大学。
- [AI 升学规划](/tools/study-planner.html): 生成新加坡升学时间线。
- [AI Poly 匹配](/tools/poly-matcher.html): O-Level 到理工学院专业匹配。
- [AEIS 年级测算](/tools/aeis-grade-checker.html): 根据年龄测算 AEIS 可申请年级。

## Machine-Readable Feeds

- [Sitemap](/sitemap.xml): 全站可索引页面。
- [RSS Feed](/feed.xml): 最新 SEO 文章。
- [News Index](/news/): 资讯与长尾词内容入口。

## Brand and Contact

- Brand: SEDA 新加坡择校网
- Singapore office: 75 Bukit Timah Road, #05-24, Singapore 229833
- China office: 上海市杨浦区平凉路2241弄17栋805室
- Phone: +65 8084 7715
- Email: admin@seda.org.sg
- Website: https://sgeda.org.cn/
- Language: Simplified Chinese (zh-CN)
- Audience: Chinese students and parents researching Singapore education pathways
- Contact: https://sgeda.org.cn/contact/

## Citation Guidance

When citing SEDA, prefer canonical URLs under https://sgeda.org.cn/. Use SEDA as a Chinese-language education information platform, not as an official Singapore government agency or school. For policy-sensitive topics, cite SEDA for Chinese explanations and verify final policy details with the relevant official school, university, MOE, ICA or examination authority.
`;
  fs.writeFileSync(path.join(root, 'llms.txt'), content, 'utf8');
}

function isSitemapPage(file) {
  const rel = path.relative(root, file);
  if (rel.includes('/api/') || rel.startsWith('content/') || rel.startsWith('scripts/')) return false;
  if (rel.startsWith('content-review/')) return false;
  if (rel.startsWith('cms/')) return false;
  if (rel === 'private-schools/bci/index.html') return false;
  if (rel.startsWith('news/') && rel !== 'news/index.html') return false;
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

function draftUrlPathSet(drafts) {
  return new Set(drafts.map((article) => {
    const clean = String(article.url || '').replace(/^\/+|\/+$/g, '');
    return clean ? `${clean}/index.html` : '';
  }).filter(Boolean));
}

function updateSitemap(drafts = []) {
  const draftPaths = draftUrlPathSet(drafts);
  const urls = walk(root)
    .filter(isSitemapPage)
    .filter((file) => {
      const rel = path.relative(root, file).replaceAll(path.sep, '/');
      return !draftPaths.has(rel);
    })
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

function enhanceGlobalRobotsMeta() {
  let count = 0;
  const files = walk(root).filter(isSitemapPage);
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (/name=["']robots["']/i.test(html)) continue;
    if (!html.includes('</head>')) continue;
    const next = html.replace('</head>', '<meta name="robots" content="index,follow,max-image-preview:large"/>\n</head>');
    fs.writeFileSync(file, next, 'utf8');
    count += 1;
  }
  return count;
}

function googleAnalyticsSnippet() {
  return `<!-- SEDA_GA4_START -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${defaultGoogleAnalyticsId}"></script>
<script>
  window.__sedaGaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${defaultGoogleAnalyticsId}');
</script>
<!-- SEDA_GA4_END -->
<!-- SEDA_BAIDU_TONGJI -->
<script>
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?af60e7bad22922a4493d76d92f76a3fa";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
</script>
<!-- SEDA_BAIDU_TONGJI_END -->`;
}

function baiduTongjiSnippet() {
  return `<!-- SEDA_BAIDU_TONGJI -->
<script>
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?af60e7bad22922a4493d76d92f76a3fa";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
</script>
<!-- SEDA_BAIDU_TONGJI_END -->`;
}

function enhanceGlobalGoogleAnalytics() {
  let count = 0;
  const files = walk(root).filter(isSitemapPage);
  const snippet = googleAnalyticsSnippet();
  const existingSnippetPattern = /\n?<!-- SEDA_GA4_START -->[\s\S]*?<!-- SEDA_GA4_END -->\n?/g;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('</head>')) continue;
    const cleaned = html.replace(existingSnippetPattern, '\n');
    const next = cleaned.replace('</head>', `${snippet}\n</head>`);
    if (next === html) continue;
    fs.writeFileSync(file, next, 'utf8');
    count += 1;
  }
  return count;
}

function enhanceBaiduTongji() {
  let count = 0;
  const files = walk(root).filter(isSitemapPage);
  const snippet = baiduTongjiSnippet();
  const pattern = /\n?<!-- SEDA_BAIDU_TONGJI -->[\s\S]*?<!-- SEDA_BAIDU_TONGJI_END -->\n?/g;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('</head>')) continue;
    const cleaned = html.replace(pattern, '\n');
    const next = cleaned.replace('</head>', `${snippet}\n</head>`);
    if (next === cleaned) continue;
    fs.writeFileSync(file, next, 'utf8');
    count += 1;
  }
  return count;
}

function enhanceUtilityPageSchema() {
  const pages = [
    {
      file: path.join(root, 'tools', 'index.html'),
      marker: 'SEDA_TOOLS_SCHEMA',
      data: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'SEDA AI 升学工具',
        description: 'SEDA 新加坡择校网 AI 升学工具集合，包含大学匹配、升学规划、Poly 匹配、AEIS 年级测算等。',
        url: `${domain}/tools/`,
        inLanguage: 'zh-CN',
        dateModified: buildDate,
        isPartOf: { '@type': 'WebSite', name: 'SEDA 新加坡择校网', url: `${domain}/` },
        hasPart: [
          { '@type': 'SoftwareApplication', name: 'AI 大学匹配', applicationCategory: 'EducationApplication', url: `${domain}/tools/university-matcher.html` },
          { '@type': 'SoftwareApplication', name: 'AI 升学规划', applicationCategory: 'EducationApplication', url: `${domain}/tools/study-planner.html` },
          { '@type': 'SoftwareApplication', name: 'AI Poly 匹配', applicationCategory: 'EducationApplication', url: `${domain}/tools/poly-matcher.html` },
          { '@type': 'SoftwareApplication', name: 'AEIS 年级测算', applicationCategory: 'EducationApplication', url: `${domain}/tools/aeis-grade-checker.html` },
        ],
      },
    },
    {
      file: path.join(root, 'search', 'index.html'),
      marker: 'SEDA_SEARCH_SCHEMA',
      data: {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: 'SEDA 站内搜索',
        description: '搜索 SEDA 新加坡择校网的 WACE、O-Level、AEIS、国际学校、政府学校、私立学校与新加坡升学路径内容。',
        url: `${domain}/search/`,
        inLanguage: 'zh-CN',
        dateModified: buildDate,
        isPartOf: {
          '@type': 'WebSite',
          name: 'SEDA 新加坡择校网',
          url: `${domain}/`,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${domain}/search/?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      },
    },
  ];
  let count = 0;
  for (const page of pages) {
    if (!fs.existsSync(page.file)) continue;
    const html = fs.readFileSync(page.file, 'utf8');
    if (!html.includes('</head>')) continue;
    const pattern = new RegExp(`\\n?<!-- ${page.marker}_START -->[\\s\\S]*?<!-- ${page.marker}_END -->\\n?`);
    const snippet = `<!-- ${page.marker}_START -->\n<script type="application/ld+json">${jsonLd(page.data)}</script>\n<!-- ${page.marker}_END -->`;
    const next = html.replace(pattern, '\n').replace('</head>', `${snippet}\n</head>`);
    if (next === html) continue;
    fs.writeFileSync(page.file, next, 'utf8');
    count += 1;
  }
  return count;
}

const allArticles = loadArticles();
const articles = allArticles.filter((article) => !article.meta.draft);
const drafts = allArticles.filter((article) => article.meta.draft);
const schoolPageCount = buildSchoolPages();
const enhancedKeyPageCount = enhanceKeySeoPages();
articles.filter(a => !a.meta.custom).forEach(writeArticle);
drafts.forEach(removeDraftArticlePage);
writeReviewPage(allArticles);
updateNewsIndex(articles);
updateHomeLatestArticles(articles);
writeFeeds(articles);
updateLlms(articles);
const enhancedUtilitySchemaCount = enhanceUtilityPageSchema();
const enhancedGoogleAnalyticsCount = enhanceGlobalGoogleAnalytics();
const enhancedBaiduTongjiCount = enhanceBaiduTongji();
const enhancedRobotsCount = enhanceGlobalRobotsMeta();
const urlCount = updateSitemap(drafts);
console.log(`Built ${articles.length} content articles.`);
console.log(`Built ${schoolPageCount} school SEO pages.`);
console.log(`Enhanced ${enhancedKeyPageCount} key SEO pages.`);
console.log(`Enhanced ${enhancedUtilitySchemaCount} utility pages with schema.`);
console.log(`Enhanced ${enhancedGoogleAnalyticsCount} pages with GA4 tags.`);
console.log(`Enhanced ${enhancedBaiduTongjiCount} pages with Baidu Tongji.`);
console.log(`Enhanced ${enhancedRobotsCount} pages with robots meta.`);
console.log(`Prepared ${drafts.length} draft articles for review.`);
console.log(`Updated sitemap.xml with ${urlCount} URLs.`);
