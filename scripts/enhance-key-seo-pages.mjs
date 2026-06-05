import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const markerStart = '<!-- SEDA_KEY_SEO_START -->';
const markerEnd = '<!-- SEDA_KEY_SEO_END -->';

function escapeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, html) {
  fs.writeFileSync(file, html, 'utf8');
}

function stripExisting(html) {
  const pattern = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}\\n?`, 'g');
  return html.replace(pattern, '');
}

function injectHead(html, block) {
  const clean = stripExisting(html);
  if (!clean.includes('</head>')) throw new Error('Missing </head> in key SEO page');
  return clean.replace('</head>', `${block}\n</head>`);
}

function buildBlock(page) {
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: `${domain}${page.path}`,
    inLanguage: 'zh-CN',
    isPartOf: {
      '@type': 'WebSite',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
    about: page.about.map((name) => ({ '@type': 'Thing', name })),
    publisher: {
      '@type': 'Organization',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${page.title}核心入口`,
    itemListElement: page.links.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${domain}${item.url}`,
    })),
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
  const aiSummary = page.summary.map((item) => `<meta name="ai-summary" content="${item.replaceAll('"', '&quot;')}"/>`).join('\n');
  return `${markerStart}
<meta name="robots" content="index,follow,max-image-preview:large"/>
<meta name="googlebot" content="index,follow"/>
<meta name="bingbot" content="index,follow"/>
${aiSummary}
<script type="application/ld+json">${escapeJson(webPage)}</script>
<script type="application/ld+json">${escapeJson(itemList)}</script>
<script type="application/ld+json">${escapeJson(faq)}</script>
${markerEnd}`;
}

const pages = [
  {
    path: '/aeis/',
    file: 'aeis/index.html',
    title: 'AEIS 考试攻略',
    description: '面向中国学生的新加坡 AEIS 入学考试攻略，覆盖年龄、英文、数学、备考时间线、政府中小学入学路径和家长常见问题。',
    about: ['AEIS', 'S-AEIS', '新加坡政府学校', '国际学生入学考试', '小学插班', '中学插班'],
    summary: [
      'AEIS 是国际学生进入新加坡政府小学和中学的重要考试入口。',
      '中国学生备考 AEIS 的核心不是数学，而是英文阅读、写作和课堂适应。',
      'AEIS 页面需要和年龄要求、数学备考、英文备考、政府学校数据库形成强内链。',
    ],
    links: [
      { name: 'AEIS 年龄要求', url: '/aeis/age-requirements/' },
      { name: 'AEIS 数学备考', url: '/aeis/math/' },
      { name: 'AEIS 英文备考', url: '/aeis/english/' },
      { name: '政府小学数据库', url: '/primary-schools/' },
      { name: '政府中学数据库', url: '/secondary-schools/' },
    ],
    faq: [
      { q: 'AEIS 是什么考试？', a: 'AEIS 是新加坡教育部为国际学生申请政府小学和中学设置的集中入学考试，主要考英文和数学。' },
      { q: '中国学生 AEIS 最难在哪里？', a: '多数中国学生数学基础不弱，真正难点在英文阅读、写作、题目理解和进入英文课堂后的适应。' },
      { q: 'AEIS 通过后可以指定学校吗？', a: '通常不能完全指定学校，教育部会根据成绩、年级和学校学额进行分配。' },
    ],
  },
  {
    path: '/o-level/',
    file: 'o-level/index.html',
    title: 'O-Level 考试与升学攻略',
    description: '新加坡 O-Level 中文攻略，覆盖科目、评分、JC、Poly、私立路径、中国学生备考重点和家长常见问题。',
    about: ['O-Level', 'O 水准', 'JC', 'Poly', '新加坡中学', 'L1R5', 'ELR2B2'],
    summary: [
      'O-Level 是新加坡中学阶段最重要的升学考试之一，直接影响 JC、Poly 和后续大学路径。',
      '中国学生准备 O-Level，要同时理解英文、数学、科学、人文和评分规则。',
      'O-Level 页面应和 JC、Poly、学校数据库、科目页和评分页形成长尾内链。',
    ],
    links: [
      { name: 'O-Level 评分规则', url: '/o-level/scoring/' },
      { name: 'O-Level 科目选择', url: '/o-level/subjects/' },
      { name: 'O-Level 申请 JC', url: '/o-level-jc/' },
      { name: 'O-Level 申请 Poly', url: '/o-level-poly/' },
      { name: '政府中学数据库', url: '/secondary-schools/' },
    ],
    faq: [
      { q: 'O-Level 是什么？', a: 'O-Level 是新加坡中学阶段的重要考试，成绩可用于申请 JC、Poly、MI 或其他升学路径。' },
      { q: 'O-Level 申请 JC 看什么？', a: 'JC 通常重点看 L1R5 成绩，同时不同学校和年份的录取分数会变化。' },
      { q: 'O-Level 申请 Poly 看什么？', a: 'Poly 通常看 ELR2B2、科目要求和专业竞争情况，选专业比单纯选学校更重要。' },
    ],
  },
  {
    path: '/secondary-schools/',
    file: 'secondary-schools/index.html',
    title: '新加坡政府中学数据库',
    description: '新加坡政府中学中文数据库，帮助中国家长理解中学类型、IP、O-Level、SAP、DSA、AEIS 和 SEC 阶段选校。',
    about: ['新加坡政府中学', 'Secondary School', 'SEC', 'IP', 'O-Level', 'AEIS', 'SAP 学校'],
    summary: [
      'Secondary School 是中国家长理解新加坡中学路径的核心入口。',
      'SEC 阶段要同时看学校类型、课程路径、英文适应、O-Level/IP 出口和交通区域。',
      '政府中学数据库要和每个学校详情页、AEIS、O-Level、JC、Poly 页面形成强内链。',
    ],
    links: [
      { name: 'AEIS 考试攻略', url: '/aeis/' },
      { name: 'O-Level 课程', url: '/o-level/' },
      { name: 'JC 初级学院', url: '/jc/' },
      { name: 'Poly 理工学院', url: '/poly/' },
      { name: '学校数据库总览', url: '/school-database/' },
    ],
    faq: [
      { q: 'SEC 是什么意思？', a: 'SEC 通常指 Secondary 中学阶段，例如 Sec 1 到 Sec 4/5，对应新加坡政府中学学习阶段。' },
      { q: '中国学生怎么进新加坡政府中学？', a: '常见路径包括 AEIS/S-AEIS、学校转学安排或其他符合条件的入学路径，具体要看年龄、年级、成绩和学额。' },
      { q: '政府中学一定比国际学校好吗？', a: '不一定。政府中学费用较低、本地体系强，但英文和适应压力较高；国际学校课程更国际化，费用也更高。' },
    ],
  },
];

export function enhanceKeySeoPages() {
  let count = 0;
  for (const page of pages) {
    const file = path.join(root, page.file);
    if (!fs.existsSync(file)) continue;
    write(file, injectHead(read(file), buildBlock(page)));
    count += 1;
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Enhanced ${enhanceKeySeoPages()} key SEO pages.`);
}
