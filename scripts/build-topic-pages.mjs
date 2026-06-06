import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';

const topics = [
  {
    slug: 'aeis',
    title: 'AEIS 新加坡政府学校插班专题',
    h1: 'AEIS 新加坡政府学校插班专题',
    description: '面向中国家长的 AEIS / S-AEIS 备考、年龄要求、政府小学和政府中学插班路径专题。',
    answer: 'AEIS 是中国学生进入新加坡政府小学和政府中学的重要路径之一。家长需要同时判断年龄、年级、英文能力、数学英文题适应度和备选学校安排。',
    keywords: ['aeis', 's-aeis', '政府学校', '政府小学', '政府中学', '插班', '年龄'],
    links: [
      ['AEIS 考试攻略', '/aeis/'],
      ['AEIS 年龄要求', '/aeis/age-requirements/'],
      ['政府小学数据库', '/primary-schools/'],
      ['政府中学数据库', '/secondary-schools/'],
    ],
    questions: ['AEIS 适合哪些中国学生？', 'AEIS 失败后还有什么路径？', 'AEIS 备考要提前多久？'],
  },
  {
    slug: 'o-level',
    title: 'O-Level 新加坡中学升学专题',
    h1: 'O-Level 新加坡中学升学专题',
    description: '整理 O-Level 课程、JC、Poly、科目选择、难度和国际学生升学路径。',
    answer: 'O-Level 是新加坡中学阶段最重要的考试路径之一，直接影响学生后续进入 JC、Poly 或其他国际课程。中国学生要特别重视英文、写作和科目组合。',
    keywords: ['o-level', 'o水准', 'jc', 'poly', '中学', 'sec', '政府中学'],
    links: [
      ['O-Level 课程总览', '/o-level/'],
      ['O-Level 申请 JC', '/o-level-jc/'],
      ['O-Level 申请 Poly', '/o-level-poly/'],
      ['政府中学数据库', '/secondary-schools/'],
    ],
    questions: ['O-Level 难吗？', 'O-Level 申请 JC 和 Poly 怎么选？', '国际学生读 O-Level 要注意什么？'],
  },
  {
    slug: 'wace',
    title: 'WACE 国际高中与 ATAR 升学专题',
    h1: 'WACE 国际高中与 ATAR 升学专题',
    description: '聚合 WACE 课程、ATAR、选课、WACE vs A-Level、NUS/NTU 和海外大学申请内容。',
    answer: 'WACE 不只是澳洲课程，它的价值在于课程连续性、ATAR 评价体系和国际大学申请出口。对部分中国学生来说，WACE 比传统 A-Level 更容易形成稳定升学路径。',
    keywords: ['wace', 'atar', 'eald', 'methods', 'specialist', 'a-level', '国际高中'],
    links: [
      ['WACE 课程总览', '/wace/'],
      ['WACE vs A-Level', '/wace-vs-a-level/'],
      ['WACE ATAR', '/wace-atar/'],
      ['WACE 申请 NUS / NTU', '/wace-nus-ntu/'],
    ],
    questions: ['WACE 适合中国学生吗？', 'WACE 和 A-Level 怎么选？', 'WACE 申请新加坡大学看什么？'],
  },
  {
    slug: 'singapore-government-schools',
    title: '新加坡政府学校择校专题',
    h1: '新加坡政府学校择校专题',
    description: '覆盖新加坡政府小学、政府中学、AEIS、PSLE、O-Level 和中国学生择校路径。',
    answer: '新加坡政府学校路径适合希望进入本地教育体系、预算相对可控、愿意长期适应英文环境的家庭。核心难点通常是入学考试、英文适应和学额限制。',
    keywords: ['政府学校', '政府小学', '政府中学', 'aeis', 'psle', 'o-level'],
    links: [
      ['政府学校指南', '/government-schools/'],
      ['政府小学数据库', '/primary-schools/'],
      ['政府中学数据库', '/secondary-schools/'],
      ['AEIS 考试攻略', '/aeis/'],
    ],
    questions: ['新加坡政府学校适合中国学生吗？', '政府学校和国际学校怎么选？', 'AEIS 后能指定学校吗？'],
  },
  {
    slug: 'international-schools',
    title: '新加坡国际学校择校专题',
    h1: '新加坡国际学校择校专题',
    description: '整理 IB、A-Level、IGCSE、AP、WACE、英式、美式、澳洲和小规模国际学校选择。',
    answer: '国际学校选择不能只看校园和排名，关键是课程体系、英文环境、大学申请方向、学费预算和孩子是否适应国际化课堂。',
    keywords: ['国际学校', 'ib', 'igcse', 'a-level', 'ap', 'wace', '学费'],
    links: [
      ['国际学校指南', '/international-school/'],
      ['国际学校名单', '/international-school/schools/'],
      ['IB 课程', '/ib/'],
      ['WACE 课程', '/wace/'],
    ],
    questions: ['新加坡国际学校一年多少钱？', 'IB、A-Level、AP、WACE 怎么选？', '国际学校适合转轨学生吗？'],
  },
  {
    slug: 'singapore-university',
    title: '新加坡大学申请专题',
    h1: '新加坡大学申请专题',
    description: '聚合 NUS、NTU、SMU、SUTD、SIT、SUSS、UAS、公立大学申请和中国学生本科路径。',
    answer: '新加坡大学申请要把成绩体系、专业要求、英文能力、文书材料和就业方向放在一起看。中国学生可以通过 A-Level、IB、Poly Diploma、高考或国际课程申请。',
    keywords: ['大学', 'nus', 'ntu', 'smu', 'sutd', 'sit', 'suss', 'uas', '本科申请'],
    links: [
      ['新加坡公立大学总览', '/university/'],
      ['NUS 新加坡国立大学', '/university/nus/'],
      ['NTU 南洋理工大学', '/university/ntu/'],
      ['中国学生升学路径', '/pathway/'],
    ],
    questions: ['中国学生怎么申请 NUS / NTU？', 'Poly 可以升新加坡大学吗？', '新加坡大学专业怎么选？'],
  },
  {
    slug: 'study-cost',
    title: '新加坡留学费用专题',
    h1: '新加坡留学费用专题',
    description: '整理政府学校、国际学校、Poly、大学、住宿、生活费和陪读相关预算。',
    answer: '新加坡留学费用不能只看学费，要把申请费、注册费、住宿、生活费、保险、校车、餐费、陪读和后续升学成本一起算。',
    keywords: ['费用', '学费', '预算', '住宿', '陪读', '国际学校', '大学'],
    links: [
      ['新加坡留学费用', '/guides/cost/'],
      ['住宿方案', '/guides/accommodation/'],
      ['陪读准证', '/guides/dependent-pass/'],
      ['国际学校费用', '/international-school/singapore-international-school-fees/'],
    ],
    questions: ['新加坡留学一年多少钱？', '国际学校和政府学校费用差多少？', '家长陪读要准备哪些成本？'],
  },
];

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

function articleUrl(article) {
  if (article.url) return article.url;
  const category = article.meta?.category || 'guides';
  const slug = article.meta?.slug || '';
  return `/${category}/${slug}/`.replace(/\/+/g, '/');
}

function articleText(article) {
  return [
    article.meta?.title,
    article.meta?.description,
    article.meta?.category,
    article.meta?.categoryLabel,
    article.meta?.slug,
  ].join(' ').toLowerCase();
}

function matchingArticles(topic, articles) {
  return articles
    .map((article) => {
      const text = articleText(article);
      const score = topic.keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
      return { article, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.article.meta.date || '').localeCompare(String(a.article.meta.date || '')))
    .map((item) => item.article)
    .slice(0, 18);
}

function renderCards(items) {
  return items.map((article) => `
        <a class="article-card" href="${articleUrl(article)}">
          <span class="tag">${escapeHtml(article.meta.categoryLabel || article.meta.category || 'SEO文章')}</span>
          <h3>${escapeHtml(article.meta.title || 'SEDA 文章')}</h3>
          <p>${escapeHtml(article.meta.description || '面向中国家长的新加坡升学长尾内容。')}</p>
        </a>`).join('\n');
}

function renderTopic(topic, articles, header, footer) {
  const matched = matchingArticles(topic, articles);
  const canonical = `${domain}/topics/${topic.slug}/`;
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      ...topic.links.map(([name, href], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        url: `${domain}${href}`,
      })),
      ...matched.map((article, index) => ({
        '@type': 'ListItem',
        position: topic.links.length + index + 1,
        name: article.meta.title,
        url: `${domain}${articleUrl(article)}`,
      })),
    ],
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: topic.questions.map((question) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: `${question}需要结合学生年龄、英文基础、预算和目标升学路径判断。SEDA 建议家长先阅读本专题内的核心页面，再根据孩子情况选择学校和课程。`,
      },
    })),
  };
  const page = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: topic.title,
    headline: topic.h1,
    description: topic.description,
    url: canonical,
    inLanguage: 'zh-CN',
    about: topic.keywords.map((keyword) => ({ '@type': 'Thing', name: keyword })),
    mainEntity: itemList,
    publisher: { '@type': 'Organization', name: 'SEDA 新加坡择校网', url: `${domain}/` },
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${escapeHtml(topic.title)} | SEDA 新加坡择校网</title>
<meta name="description" content="${escapeHtml(topic.description)}"/>
<meta name="keywords" content="${escapeHtml(topic.keywords.join(','))}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${canonical}"/>
<link rel="stylesheet" href="/seda-site.css?v=31"/>
<script type="application/ld+json">${jsonLd(page)}</script>
<script type="application/ld+json">${jsonLd(itemList)}</script>
<script type="application/ld+json">${jsonLd(faq)}</script>
</head>
<body>
${header}
<nav class="breadcrumb" aria-label="面包屑导航"><a href="/">首页</a> <span class="bc-sep">›</span> <a href="/topics/">专题</a> <span class="bc-sep">›</span> <span>${escapeHtml(topic.title)}</span></nav>
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">SEO/GEO 专题</p>
    <h1>${escapeHtml(topic.h1)}</h1>
    <p class="hero-subtitle">${escapeHtml(topic.description)}</p>
  </section>
  <section class="section">
    <div class="content-layout">
      <article class="content-main">
        <section class="geo-summary">
          <p class="eyebrow">快速答案</p>
          <h2>${escapeHtml(topic.title)}怎么理解？</h2>
          <p>${escapeHtml(topic.answer)}</p>
        </section>
        <section class="seo-tags">
          <p class="eyebrow">专题标签</p>
          <h2>${escapeHtml(topic.title)}核心关键词</h2>
          <div class="seo-tag-cloud">${topic.keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>
        </section>
        <h2>核心入口</h2>
        <div class="quick-links">${topic.links.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</div>
        <h2>家长最常问的问题</h2>
        <div class="faq-section">
          ${topic.questions.map((question) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(question)}需要结合学生年龄、英文基础、预算和目标升学路径判断。建议先阅读本专题下方内容，再做路径选择。</p></details>`).join('\n          ')}
        </div>
      </article>
      <aside class="sidebar">
        <div class="sidebar-card">
          <h3>专题定位</h3>
          <p>本页用于聚合 SEDA 关于 ${escapeHtml(topic.title)} 的核心解释、学校页面和长尾文章，帮助搜索引擎和 AI 搜索理解主题关系。</p>
        </div>
        <div class="sidebar-card cta-card">
          <h3>需要判断孩子路径？</h3>
          <p>告诉我们孩子年龄、英文基础和目标学校，SEDA 顾问可以帮你比较路径。</p>
          <a class="btn" href="/contact/">免费咨询</a>
        </div>
      </aside>
    </div>
  </section>
  <section class="section">
    <div class="section-head">
      <p class="eyebrow">延伸阅读</p>
      <h2>${escapeHtml(topic.title)}相关文章</h2>
      <p>这些内容会随着 SEDA 每日 SEO 草稿和学校数据库更新自动扩展。</p>
    </div>
    <div class="article-grid">
${matched.length ? renderCards(matched) : topic.links.map(([label, href]) => `
        <a class="article-card" href="${href}">
          <span class="tag">核心页面</span>
          <h3>${escapeHtml(label)}</h3>
          <p>进入 ${escapeHtml(topic.title)} 的核心解释页面。</p>
        </a>`).join('\n')}
    </div>
  </section>
</main>
${footer}
<script src="/seda-site.js?v=24"></script>
</body>
</html>`;
}

function renderIndex(header, footer) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SEDA 新加坡教育专题',
    description: 'SEDA 新加坡择校网的 AEIS、O-Level、WACE、政府学校、国际学校、大学申请和留学费用专题入口。',
    url: `${domain}/topics/`,
    inLanguage: 'zh-CN',
    mainEntity: topics.map((topic, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: topic.title,
      url: `${domain}/topics/${topic.slug}/`,
    })),
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>SEDA 新加坡教育专题 | SEDA 新加坡择校网</title>
<meta name="description" content="SEDA 新加坡择校网专题入口，聚合 AEIS、O-Level、WACE、政府学校、国际学校、大学申请和留学费用。"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${domain}/topics/"/>
<link rel="stylesheet" href="/seda-site.css?v=31"/>
<script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body>
${header}
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">SEDA 专题中心</p>
    <h1>新加坡教育 SEO/GEO 专题</h1>
    <p class="hero-subtitle">把分散的学校页面、升学攻略和家长问题聚合成主题入口，方便中国家长快速理解新加坡教育路径。</p>
  </section>
  <section class="section">
    <div class="article-grid">
      ${topics.map((topic) => `<a class="article-card" href="/topics/${topic.slug}/"><span class="tag">专题</span><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.description)}</p></a>`).join('\n      ')}
    </div>
  </section>
</main>
${footer}
<script src="/seda-site.js?v=24"></script>
</body>
</html>`;
}

export function buildTopicPages(articles, header, footer) {
  const baseDir = path.join(root, 'topics');
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'index.html'), renderIndex(header, footer), 'utf8');
  for (const topic of topics) {
    const dir = path.join(baseDir, topic.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderTopic(topic, articles, header, footer), 'utf8');
  }
  return topics.length + 1;
}

export { topics };
