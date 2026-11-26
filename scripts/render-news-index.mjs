const PRIORITY_CATEGORIES = ['o-level', 'wace', 'aeis'];
const FIXED_LABELS = new Map([
  ['o-level', 'O-Level'],
  ['wace', 'WACE'],
  ['aeis', 'AEIS'],
]);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hasContent(value) {
  return value != null && String(value).trim().length > 0;
}

function validateArticleUrl(url) {
  if (typeof url !== 'string') {
    throw new TypeError('Article URL must be a site-relative path string');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    throw new TypeError(`Invalid article URL encoding: ${JSON.stringify(url)}`);
  }

  // Check both source and decoded form: encoded quotes, control characters,
  // protocol-relative paths and backslashes must not bypass the same policy.
  for (const value of [url, decoded]) {
    const pathname = value.split(/[?#]/, 1)[0];
    if (!value.startsWith('/') || value.startsWith('//')
      || /[\s\u0000-\u001f\u007f-\u009f"'<>`\\]/u.test(value)
      || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
      throw new TypeError(`Unsafe article URL: ${JSON.stringify(url)}`);
    }
  }
  return url;
}

function safeJson(data) {
  const escapes = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, character => escapes[character]);
}

function renderArticle(article) {
  const { meta, url, summary } = article;
  const date = String(meta.date ?? '');
  const description = hasContent(meta.description)
    ? String(meta.description)
    : hasContent(summary) ? String(summary) : '';
  return `        <article class="news-article">
          <h3><a href="${escapeHtml(url)}">${escapeHtml(meta.title ?? '')}</a></h3>
          <time datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>${description ? `
          <p class="news-article-description">${escapeHtml(description)}</p>` : ''}
        </article>`;
}

/**
 * Render the complete, progressively enhanced /news/ archive as static HTML.
 * Groups come only from meta.category; the three priority categories come first,
 * and other actual categories retain first-seen order. Dates are the original
 * ISO publication dates (meta.date), never meta.updated or the build date.
 * Drafts (boolean true or the frontmatter string "true") are excluded. Duplicate
 * URLs retain the first published occurrence, including its category and title.
 * Unsafe published URLs throw; the input array and article metadata are untouched.
 */
export function renderNewsArchive(articles) {
  if (!Array.isArray(articles)) {
    throw new TypeError('renderNewsArchive expects an array of articles');
  }

  const groups = new Map();
  const seenUrls = new Set();
  for (const article of articles) {
    if (!article || !article.meta || typeof article.meta !== 'object') {
      throw new TypeError('Each article must have a meta object');
    }
    const { meta } = article;
    if (meta.draft === true || meta.draft === 'true') continue;

    const url = validateArticleUrl(article.url);
    if (seenUrls.has(url)) continue;
    const category = meta.category;
    if (typeof category !== 'string' || !category.trim()) {
      throw new TypeError('Published articles must have a non-empty meta.category');
    }
    seenUrls.add(url);

    if (!groups.has(category)) {
      groups.set(category, { category, label: '', articles: [] });
    }
    const group = groups.get(category);
    if (!group.label && hasContent(meta.categoryLabel)) {
      group.label = String(meta.categoryLabel);
    }
    group.articles.push(article);
  }

  const categories = [
    ...PRIORITY_CATEGORIES.filter(category => groups.has(category)),
    ...[...groups.keys()].filter(category => !PRIORITY_CATEGORIES.includes(category)),
  ];
  const orderedGroups = categories.map(category => {
    const group = groups.get(category);
    return {
      category,
      label: FIXED_LABELS.get(category) || group.label || category,
      articles: [...group.articles].sort((a, b) =>
        String(b.meta.date ?? '').localeCompare(String(a.meta.date ?? ''))),
    };
  });
  const orderedArticles = orderedGroups.flatMap(group => group.articles);
  const total = orderedArticles.length;
  const filters = orderedGroups.map(group =>
    `    <a href="#news-${escapeHtml(group.category)}" data-news-filter="${escapeHtml(group.category)}" data-news-label="${escapeHtml(group.label)}">${escapeHtml(group.label)} <span class="news-filter-count">（${group.articles.length}）</span></a>`).join('\n');
  const sections = orderedGroups.map(group => {
    const id = `news-${group.category}`;
    const headingId = `${id}-heading`;
    return `    <section class="news-category" id="${escapeHtml(id)}" data-news-category="${escapeHtml(group.category)}" aria-labelledby="${escapeHtml(headingId)}">
      <h2 id="${escapeHtml(headingId)}">${escapeHtml(group.label)} <span class="news-category-count">（${group.articles.length} 篇）</span></h2>
      <div class="news-article-list">
${group.articles.map(renderArticle).join('\n')}
      </div>
    </section>`;
  }).join('\n');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://sgeda.org.cn/news/#articles',
    numberOfItems: total,
    itemListElement: orderedArticles.map((article, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://sgeda.org.cn${article.url}`,
      name: String(article.meta.title ?? ''),
    })),
  };

  return `<div class="news-archive" id="news-articles">
  <nav class="news-filters" aria-label="按主题查看文章">
    <a href="#news-articles" data-news-filter="all" class="is-active" aria-current="true" data-news-label="全部文章">全部 <span class="news-filter-count">（${total}）</span></a>${filters ? `\n${filters}` : ''}
  </nav>
  <p class="news-result-count" data-news-count aria-live="polite">共 ${total} 篇文章</p>
  <div class="news-category-list">${sections ? `\n${sections}\n  ` : ''}</div>
  <script type="application/ld+json" id="news-article-list-schema">${safeJson(schema)}</script>
</div>`;
}
