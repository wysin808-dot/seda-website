import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const domain = 'https://sgeda.org.cn';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function between(html, start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a === -1 || b === -1) throw new Error(`Cannot find template block ${start} ... ${end}`);
  return html.slice(a, b + end.length);
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

function schoolUrl(school) {
  return `/${school.basePath}/${school.slug}/`;
}

// Rankings, COP and promotional descriptions in legacy records are not sources.
// Drop the affected segment rather than rephrasing the judgment as another fact.
function recordText(value = '') {
  return String(value).split(/\s*\/\s*/)
    .filter(part => !/\bTier\b|\bCOP\b|热门|顶尖|精英|优质|成熟|性价比|最受欢迎|排名/i.test(part))
    .map(part => part.trim()).filter(Boolean).join(' / ');
}

function recordItems(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter(item => typeof item === 'string')
    .map(recordText).filter(Boolean))];
}

// Only a URL already held in the school's record can become an external link.
// This is URL validation, not a claim that a homepage verifies every field.
function officialUrl(school) {
  if (typeof school.sameAs !== 'string') return '';
  try {
    const url = new URL(school.sameAs);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    if (!url.hostname.includes('.') || url.hostname === 'localhost') return '';
    return url.href;
  } catch {
    return '';
  }
}

function isHigherEducation(school) {
  return ['university', 'artsUniversity', 'poly', 'private'].includes(school.type);
}

function schoolRecord(school) {
  return {
    schoolType: recordText(school.schoolType) || recordText(school.categoryLabel),
    curriculum: recordText(school.curriculum),
    location: recordText(school.location),
    majorAreas: isHigherEducation(school) ? recordItems(school.majorAreas) : [],
    admissionPaths: isHigherEducation(school) ? recordItems(school.admissionPaths) : [],
    officialUrl: officialUrl(school),
  };
}

function hasDetail(record) {
  return record.majorAreas.length > 0 || record.admissionPaths.length > 0;
}

function schemaType(school) {
  if (['university', 'artsUniversity', 'poly'].includes(school.type)) return 'CollegeOrUniversity';
  if (['primary', 'secondary', 'jc', 'international'].includes(school.type)) return 'School';
  return 'EducationalOrganization';
}

function relatedLinks(school) {
  const links = {
    primary: [
      ['政府小学目录', '/primary-schools/'],
      ['AEIS 考试', '/aeis/'],
      ['政府学校', '/government-schools/'],
      ['学生准证', '/guides/student-pass/'],
    ],
    secondary: [
      ['政府中学目录', '/secondary-schools/'],
      ['O-Level 课程', '/o-level/'],
      ['AEIS 考试', '/aeis/'],
      ['O-Level 申请 JC', '/o-level-jc/'],
    ],
    jc: [
      ['JC 初级学院', '/jc/'],
      ['A-Level 课程', '/a-level/'],
      ['公立大学', '/university/'],
      ['升学路径', '/pathway/'],
    ],
    poly: [
      ['理工学院', '/poly/'],
      ['O-Level 申请 Poly', '/o-level-poly/'],
      ['Poly 专业匹配工具', '/tools/poly-matcher.html'],
      ['公立大学', '/university/'],
    ],
    university: [
      ['公立大学', '/university/'],
      ['升学路径', '/pathway/'],
      ['理工学院', '/poly/'],
      ['A-Level 课程', '/a-level/'],
    ],
    artsUniversity: [
      ['大学目录', '/university/'],
      ['国际学校', '/international-school/'],
      ['学生准证', '/guides/student-pass/'],
      ['留学费用', '/guides/cost/'],
    ],
    international: [
      ['国际学校', '/international-school/'],
      ['国际学校目录', '/international-school/schools/'],
      ['IB 课程', '/ib/'],
      ['WACE 课程', '/wace/'],
      ['国际学校费用', '/international-school/singapore-international-school-fees/'],
    ],
    private: [
      ['私立学校目录', '/private-schools/'],
      ['私立大学路径', '/private-university/'],
      ['Foundation 预科', '/foundation/'],
      ['O-Level 课程', '/o-level/'],
      ['留学费用', '/guides/cost/'],
    ],
  };
  return links[school.type] || [['学校目录', '/school-database/'], ['留学指南', '/guides/']];
}

function schoolMeta(school, record) {
  const detail = hasDetail(record);
  const name = school.nameEn && school.nameEn !== school.nameZh
    ? `${school.nameZh}（${school.nameEn}）` : school.nameZh;
  const facts = [record.location, record.schoolType, record.curriculum].filter(Boolean).join('；');
  return {
    title: `${school.nameZh}｜${detail ? '课程与入学资料' : '学校资料记录'}`,
    h1: school.nameZh,
    description: `${name}：${facts}。${detail ? '本页保留现有专业方向和入学方式资料，不是完整申请或费用指南。' : '本页为待完善资料记录，尚未整理学校专属入学要求与收费资料。'}`,
  };
}

function schoolEntity(school, record) {
  return {
    '@type': schemaType(school),
    '@id': `${domain}${schoolUrl(school)}#school`,
    name: school.nameZh,
    ...(school.nameEn ? { alternateName: school.nameEn } : {}),
    description: [record.schoolType, record.curriculum].filter(Boolean).join('；'),
    ...(record.location ? { address: record.location } : {}),
    ...(record.officialUrl ? { sameAs: record.officialUrl, url: record.officialUrl } : {}),
  };
}

function renderRecordList(id, title, items) {
  if (!items.length) return '';
  return `<section aria-labelledby="${id}">
        <h2 id="${id}">${escapeHtml(title)}</h2>
        <ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>`;
}

function renderContact(title, text) {
  return `<section class="contact-section" id="contact" aria-labelledby="contact-title">
        <div>
          <p class="eyebrow">联系 SEDA</p>
          <h2 id="contact-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(text)}</p>
          <p><a href="/contact/">查看联系方式与咨询说明</a></p>
        </div>
        <div class="contact-action-stack">
          <div class="seda-wechat-card">
            <div class="seda-wechat-head">
              <div><strong>新加坡择校顾问 Amy</strong><span>扫码联系 SEDA</span></div>
              <button type="button" class="seda-copy-wechat" data-wechat="SEDAGUIDE">复制微信号</button>
            </div>
            <div class="seda-wechat-body">
              <img class="seda-wechat-qr" src="/assets/wechat-amy-seda-guide.jpg" alt="新加坡择校顾问Amy微信二维码" loading="lazy" decoding="async">
              <div class="seda-wechat-info">
                <p class="seda-wechat-id">微信号：<b>SEDAGUIDE</b></p>
                <p><a href="/contact/">联系与资料纠错</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>`;
}

export function renderPage(school, header = '', footer = '') {
  const url = schoolUrl(school);
  const record = schoolRecord(school);
  const { title, h1, description } = schoolMeta(school, record);
  const related = relatedLinks(school);
  const entity = schoolEntity(school, record);
  const schoolSchema = { '@context': 'https://schema.org', ...entity };
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${domain}${url}#webpage`,
    name: title,
    headline: h1,
    description,
    url: `${domain}${url}`,
    inLanguage: 'zh-CN',
    mainEntity: { '@id': entity['@id'] },
    isPartOf: { '@type': 'WebSite', name: 'SEDA 新加坡择校网', url: `${domain}/` },
    publisher: { '@type': 'Organization', name: 'SEDA 新加坡择校网', url: `${domain}/` },
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: `${domain}/` },
      { '@type': 'ListItem', position: 2, name: school.categoryLabel, item: `${domain}/${school.basePath}/` },
      { '@type': 'ListItem', position: 3, name: school.nameZh, item: `${domain}${url}` },
    ],
  };
  const sections = [
    ['school-record', '基本资料'],
    ['school-materials', '资料范围'],
    ...(record.majorAreas.length ? [['school-majors', '专业与课程方向']] : []),
    ...(record.admissionPaths.length ? [['school-admissions', '入学方式资料']] : []),
    ...(record.officialUrl || school.officialSource ? [['school-sources', '资料出处与官网']] : []),
    ['school-related', '相关栏目'],
    ['contact', '联系 SEDA'],
  ];
  const basicFields = [
    ['学校类型', record.schoolType], ['课程', record.curriculum],
    ['区域', record.location], ['学校分类', school.categoryLabel],
  ].filter(([, value]) => value);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${escapeHtml(title)} | SEDA 新加坡择校网</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${domain}${url}"/>
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="${domain}/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v=36"/>
<script type="application/ld+json">${jsonLd(schoolSchema)}</script>
<script type="application/ld+json">${jsonLd(webPageSchema)}</script>
<script type="application/ld+json">${jsonLd(breadcrumbSchema)}</script>
</head>
<body>
${header}
<nav class="breadcrumb" aria-label="面包屑导航"><a href="/">首页</a> <span class="bc-sep">›</span> <a href="/${school.basePath}/">${escapeHtml(school.categoryLabel)}</a> <span class="bc-sep">›</span> <span>${escapeHtml(school.nameZh)}</span></nav>
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">${escapeHtml(school.categoryLabel)} · ${escapeHtml(school.nameEn)}</p>
    <h1>${escapeHtml(h1)}</h1>
    <p class="hero-subtitle">${escapeHtml(description)}</p>
  </section>
  <div class="content-layout">
    <article class="content-main">
      <section aria-labelledby="school-record">
        <h2 id="school-record">${escapeHtml(school.nameZh)}基本资料</h2>
        <div class="stats-bar">
          ${basicFields.map(([label, value]) => `<div class="stat-item"><div class="num">${escapeHtml(value)}</div><div class="label">${label}</div></div>`).join('\n          ')}
        </div>
      </section>
      <section class="geo-summary" aria-labelledby="school-materials">
        <p class="eyebrow">${hasDetail(record) ? '资料范围' : '待完善资料记录'}</p>
        <h2 id="school-materials">本页收录哪些资料？</h2>
        <p>${hasDetail(record) ? '以下专业方向与入学方式来自本站现有学校资料；尚未逐项整理对应课程的录取条件、开放批次和收费表，不表示申请资格或录取承诺。' : '目前仅收录校名、区域、学校类型和课程记录。学校专属入学要求与收费资料待完善，本页不是完整申请或费用指南。'}</p>
      </section>
      ${renderRecordList('school-majors', '专业与课程方向', record.majorAreas)}
      ${renderRecordList('school-admissions', '入学方式资料', record.admissionPaths)}
      ${record.officialUrl || school.officialSource ? `<section aria-labelledby="school-sources">
        <h2 id="school-sources">资料出处与官网</h2>
        ${school.officialSource ? `<p class="source-note">现有学校资料注明的出处：${escapeHtml(school.officialSource)}。</p>` : ''}
        ${record.officialUrl ? `<p><a href="${escapeHtml(record.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(school.nameZh)}官网</a></p><p>官网链接供继续查阅，不代表本页已逐项核实课程、入学要求或费用。</p>` : ''}
      </section>` : ''}
      <section class="related-section" aria-labelledby="school-related">
        <h2 id="school-related">相关栏目</h2>
        <div class="quick-links">${related.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</div>
      </section>
      ${renderContact(`咨询或补充${school.nameZh}资料`, '如需咨询，或发现本页资料有误，可联系 SEDA 并提供对应学校的资料链接。')}
    </article>
    <aside class="sidebar">
      <nav class="sidebar-card" aria-label="本页目录"><h3>本页目录</h3><ul>
        ${sections.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}
      </ul></nav>
      <div class="sidebar-card"><h3>学校目录</h3><ul>
        <li><a href="/${school.basePath}/">${escapeHtml(school.categoryLabel)}总览</a></li>
        ${related.slice(0, 3).map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('')}
      </ul></div>
    </aside>
  </div>
</main>
${footer}
<script src="/seda-site.js?v=29"></script>
</body>
</html>`.replace(/[ \t]+$/gm, '') + '\n';
}

function renderSchoolIndex(schools, header, footer, { route, title, category, breadcrumb }) {
  const sorted = [...schools].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  const description = `SEDA 收录 ${sorted.length} 所${category}的学校资料入口，可按校名查阅区域、学校类型和课程记录。各校资料详略不同，待完善记录不作为完整申请或费用指南。`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${domain}${route}`,
    inLanguage: 'zh-CN',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: sorted.length,
      itemListElement: sorted.map((school, index) => ({
        '@type': 'ListItem', position: index + 1,
        item: { '@type': 'WebPage', name: school.nameZh, url: `${domain}${schoolUrl(school)}` },
      })),
    },
    publisher: { '@type': 'Organization', name: 'SEDA 新加坡择校网', url: `${domain}/` },
  };
  const cards = sorted.map(school => {
    const record = schoolRecord(school);
    return `<a class="article-card" href="${schoolUrl(school)}">
          ${record.curriculum ? `<span class="tag">${escapeHtml(record.curriculum)}</span>` : ''}
          <h3>${escapeHtml(school.nameZh)}</h3>
          <p>${escapeHtml(school.nameEn)}</p>
          <p>${escapeHtml([record.location, record.schoolType].filter(Boolean).join(' · '))}</p>
        </a>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${escapeHtml(title)} | SEDA 新加坡择校网</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${domain}${route}"/>
<link rel="stylesheet" href="/seda-site.css?v=36"/>
<script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body>
${header}
<nav class="breadcrumb" aria-label="面包屑导航"><a href="/">首页</a> <span class="bc-sep">›</span> ${breadcrumb}<span>${escapeHtml(category)}名单</span></nav>
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">${escapeHtml(category)}目录</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="hero-subtitle">${escapeHtml(description)}</p>
  </section>
  <nav class="quick-links" aria-label="本页目录"><a href="#school-list">学校名单</a><a href="#contact">联系 SEDA</a></nav>
  <section class="section" aria-labelledby="school-list">
    <div class="section-head">
      <p class="eyebrow">学校名单</p>
      <h2 id="school-list">${sorted.length} 所${escapeHtml(category)}资料入口</h2>
      <p>按英文校名字母顺序排列，不代表学校排名。</p>
    </div>
    <div class="article-grid">
${cards}
    </div>
  </section>
  ${renderContact('学校资料咨询与纠错', '需要补充学校资料或反馈错误，可提供校名及对应资料链接。')}
</main>
${footer}
<script src="/seda-site.js?v=29"></script>
</body>
</html>`.replace(/[ \t]+$/gm, '') + '\n';
}

export function renderInternationalSchoolIndex(schools, header = '', footer = '') {
  return renderSchoolIndex(schools, header, footer, {
    route: '/international-school/schools/', title: '新加坡国际学校名单', category: '国际学校',
    breadcrumb: '<a href="/international-school/">国际学校</a> <span class="bc-sep">›</span> ',
  });
}

export function renderPrivateSchoolIndex(schools, header = '', footer = '') {
  return renderSchoolIndex(schools, header, footer, {
    route: '/private-schools/', title: '新加坡私立学校名单', category: '私立学校', breadcrumb: '',
  });
}

export function buildSchoolPages(root = process.cwd()) {
  const dataFile = path.join(root, 'content', 'schools', 'seo-schools.json');
  if (!fs.existsSync(dataFile)) return 0;
  const home = read(path.join(root, 'index.html'));
  const header = between(home, '<header class="site-header">', '</header>');
  const footer = between(home, '<footer class="site-footer">', '</footer>');
  const schools = JSON.parse(read(dataFile));
  for (const school of schools) {
    if (school.customContent) continue;
    const dir = path.join(root, schoolUrl(school));
    const file = path.join(dir, 'index.html');
    // A reviewed hand-maintained page must not be regenerated even if its
    // legacy data record has not yet acquired the customContent flag.
    if (fs.existsSync(file) && read(file).includes('<!-- SEDA_CUSTOM_PAGE -->')) continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, renderPage(school, header, footer), 'utf8');
  }
  const internationalSchools = schools.filter(school => school.type === 'international');
  if (internationalSchools.length) {
    const indexDir = path.join(root, 'international-school', 'schools');
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, 'index.html'), renderInternationalSchoolIndex(internationalSchools, header, footer), 'utf8');
  }
  const privateSchools = schools.filter(school => school.type === 'private');
  if (privateSchools.length) {
    const indexDir = path.join(root, 'private-schools');
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, 'index.html'), renderPrivateSchoolIndex(privateSchools, header, footer), 'utf8');
  }
  return schools.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const count = buildSchoolPages();
  console.log(`Built school records and directories from ${count} entries.`);
}
