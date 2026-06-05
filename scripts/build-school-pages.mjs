import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const dataFile = path.join(root, 'content', 'schools', 'seo-schools.json');

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

function typeIntro(school) {
  const map = {
    primary: '小学阶段看似离大学很远，但它会影响孩子的英文基础、学习习惯、PSLE 准备节奏，以及后续进入政府中学的可能性。',
    secondary: '中学阶段是新加坡教育体系里非常关键的分水岭，关系到 O-Level、IP、JC、Poly 以及未来大学路径。',
    jc: 'JC 是新加坡 A-Level 路径的核心阶段，适合学术基础强、目标大学较明确、能承受高强度学习节奏的学生。',
    poly: 'Poly 更强调专业能力和应用学习，适合不想只走传统 A-Level 路径、希望尽早进入专业方向的学生。',
    international: '国际学校的重点不只是学费和校园，而是课程体系、英文环境、大学申请方向和孩子是否适应国际化学习方式。',
  };
  return map[school.type] || '选校不是只看名气，而是看孩子的年龄、英文、目标路径和家庭预算是否匹配。';
}

function admissionCopy(school) {
  if (school.type === 'primary') {
    return '国际学生进入新加坡政府小学，通常需要通过 AEIS / S-AEIS 或相关入学安排，由教育部根据成绩与学额统一分配。热门小学不等于可以直接指定录取，家长要提前理解年龄、年级、英文和学额限制。';
  }
  if (school.type === 'secondary') {
    return '政府中学路径通常涉及 PSLE、AEIS / S-AEIS、DSA 或校内升学衔接。对中国学生来说，最难的往往不是数学，而是英文、校内表达、阅读速度和长期适应能力。';
  }
  if (school.type === 'jc') {
    return 'JC 录取通常与 O-Level、IP 衔接或校内升学路径相关。国际学生如果目标 JC，需要提前规划英文、数学、科学或人文科目，并准备 A-Level 的高强度节奏。';
  }
  if (school.type === 'poly') {
    return 'Poly 申请通常看 O-Level、相关科目成绩和专业要求。选专业时不能只看学校名气，要看课程内容、就业方向、大学衔接和孩子真实兴趣。';
  }
  return '国际学校通常需要提交成绩单、英文水平、面试或入学测评。不同学校和年级名额差异很大，申请时间线、课程体系和家庭预算都要提前确认。';
}

function feesCopy(school) {
  if (school.type === 'international') {
    return '国际学校学费差异较大，通常还会涉及申请费、注册费、校车、餐费、活动费和校服等额外支出。实际费用应以学校当年官方收费表为准。';
  }
  if (school.type === 'poly') {
    return 'Poly 学费按学生身份和专业类别不同而变化，国际学生费用通常高于本地学生。家长应同时计算生活费、住宿、保险和后续大学衔接成本。';
  }
  return '政府学校费用会根据学生身份不同而变化，例如新加坡公民、永久居民、东盟国际学生和非东盟国际学生收费不同。具体金额每年可能调整，应以 MOE 当年公布为准。';
}

function renderFaq(school) {
  const items = [
    [`${school.nameZh}适合中国学生吗？`, `${school.nameZh}是否适合中国学生，要看孩子的英文基础、年龄、学习习惯和目标路径。${school.angle}`],
    [`申请${school.nameZh}最需要注意什么？`, `家长不要只看学校名气，更要看入学路径、年级名额、英文要求、课程体系和孩子能否适应。${admissionCopy(school)}`],
    [`${school.nameZh}的费用怎么看？`, feesCopy(school)],
    [`如果进不了${school.nameZh}，还有哪些选择？`, `可以同时比较同类型学校、相邻区域学校，以及更适合孩子英文和学术节奏的路径。SEDA 建议家长准备 3-5 所备选，而不是只盯一所学校。`],
  ];
  return {
    items,
    html: `<section class="faq-section">
      <h2>${escapeHtml(school.nameZh)}常见问题</h2>
      ${items.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('\n      ')}
    </section>`,
  };
}

function relatedLinks(school) {
  const links = {
    primary: [
      ['政府小学数据库', '/primary-schools/'],
      ['AEIS 考试攻略', '/aeis/'],
      ['新加坡政府学校指南', '/government-schools/'],
      ['学生准证申请', '/guides/student-pass/'],
    ],
    secondary: [
      ['政府中学数据库', '/secondary-schools/'],
      ['O-Level 课程', '/o-level/'],
      ['AEIS 考试攻略', '/aeis/'],
      ['O-Level 申请 JC', '/o-level-jc/'],
    ],
    jc: [
      ['JC 初级学院总览', '/jc/'],
      ['A-Level 课程', '/a-level/'],
      ['新加坡公立大学', '/university/'],
      ['中国学生升学路径', '/pathway/'],
    ],
    poly: [
      ['理工学院总览', '/poly/'],
      ['O-Level 申请 Poly', '/o-level-poly/'],
      ['Poly 专业匹配工具', '/tools/poly-matcher.html'],
      ['新加坡公立大学', '/university/'],
    ],
    international: [
      ['国际学校总览', '/international-school/'],
      ['IB 课程', '/ib/'],
      ['WACE 课程', '/wace/'],
      ['新加坡国际学校费用', '/international-school/singapore-international-school-fees/'],
    ],
  };
  return links[school.type] || [['学校数据库', '/school-database/'], ['留学指南', '/guides/']];
}

function renderPage(school, header, footer) {
  const url = schoolUrl(school);
  const title = `${school.nameZh}怎么样？${school.nameEn}申请、课程与中国学生选校指南`;
  const description = `${school.nameZh}（${school.nameEn}）中文择校指南：位置、课程体系、入学路径、适合学生、费用关注点与中国家长常见问题。`;
  const keywords = [school.nameZh, school.nameEn, school.categoryLabel, '新加坡学校', '新加坡择校', '中国学生', '新加坡留学'].join(',');
  const faq = renderFaq(school);
  const related = relatedLinks(school);
  const features = school.features || [];
  const schoolSchema = {
    '@context': 'https://schema.org',
    '@type': school.type === 'international' ? 'School' : 'EducationalOrganization',
    name: school.nameZh,
    alternateName: school.nameEn,
    description,
    url: `${domain}${url}`,
    address: school.location,
    educationalCredentialAwarded: school.curriculum,
    inLanguage: 'zh-CN',
    publisher: {
      '@type': 'Organization',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: `${domain}/` },
      { '@type': 'ListItem', position: 2, name: school.categoryLabel, item: `${domain}/${school.basePath}/` },
      { '@type': 'ListItem', position: 3, name: school.nameZh },
    ],
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.items.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${escapeHtml(title)} | SEDA 新加坡择校网</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="keywords" content="${escapeHtml(keywords)}"/>
<link rel="canonical" href="${domain}${url}"/>
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="${domain}/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v=15"/>
<script type="application/ld+json">${jsonLd(schoolSchema)}</script>
<script type="application/ld+json">${jsonLd(breadcrumbSchema)}</script>
<script type="application/ld+json">${jsonLd(faqSchema)}</script>
</head>
<body>
${header}
<nav class="breadcrumb" aria-label="面包屑导航"><a href="/">首页</a> <span class="bc-sep">›</span> <a href="/${school.basePath}/">${escapeHtml(school.categoryLabel)}</a> <span class="bc-sep">›</span> <span>${escapeHtml(school.nameZh)}</span></nav>
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">${escapeHtml(school.categoryLabel)} · ${escapeHtml(school.nameEn)}</p>
    <h1>${escapeHtml(school.nameZh)}怎么样？${escapeHtml(school.nameEn)}选校指南</h1>
    <p class="hero-subtitle">${escapeHtml(description)}</p>
  </section>
  <div class="content-layout">
    <article class="content-main">
      <div class="stats-bar">
        <div class="stat-item"><div class="num">${escapeHtml(school.schoolType)}</div><div class="label">学校类型</div></div>
        <div class="stat-item"><div class="num">${escapeHtml(school.curriculum)}</div><div class="label">课程路径</div></div>
        <div class="stat-item"><div class="num">${escapeHtml(school.location)}</div><div class="label">位置区域</div></div>
        <div class="stat-item"><div class="num">${escapeHtml(school.categoryLabel)}</div><div class="label">学校分类</div></div>
      </div>

      <section class="geo-summary" aria-labelledby="school-ai-summary">
        <p class="eyebrow">AI 摘要</p>
        <h2 id="school-ai-summary">给中国家长快速理解的要点</h2>
        <ul>
          <li>${escapeHtml(school.angle)}</li>
          <li>适合人群：${escapeHtml(school.audience)}</li>
          <li>选校重点：课程体系、入学路径、英文要求、费用预算和备选学校。</li>
          <li>申请提醒：学校信息和费用每年可能变化，最终以学校或 MOE 官方信息为准。</li>
        </ul>
      </section>

      <h2>${escapeHtml(school.nameZh)}是什么类型的学校？</h2>
      <p>很多家长第一次搜索 ${escapeHtml(school.nameZh)}，通常不是只想知道学校在哪里，而是想判断：这所学校到底适不适合自己的孩子。</p>
      <p>${escapeHtml(school.angle)}</p>
      <p>${escapeHtml(typeIntro(school))}</p>

      <h2>学校特色与适合学生</h2>
      <p>${escapeHtml(school.nameZh)}的关键词可以概括为：${features.map(escapeHtml).join('、')}。这些标签不能直接等同于“适合所有学生”，但能帮助家长先判断学校气质。</p>
      <ul>
        ${features.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n        ')}
      </ul>
      <p>如果孩子英文基础稳定、自我管理能力较强，并且家庭愿意长期规划升学路径，那么这类学校值得重点研究。反过来，如果孩子刚从中文环境切换到英文体系，家长就要更重视过渡期和备选路线。</p>

      <h2>入学路径怎么理解？</h2>
      <p>${escapeHtml(admissionCopy(school))}</p>
      <p>对中国学生来说，选校不能只问“能不能进”，还要问“进去之后能不能跟上”。英文阅读、课堂表达、写作、项目展示和考试节奏，都会影响真实适应度。</p>

      <h2>费用和家庭预算</h2>
      <p>${escapeHtml(feesCopy(school))}</p>
      <p>SEDA 建议家长把预算分成四块看：学费、生活费、住宿或陪读成本、后续升学成本。只看一年学费，容易低估整个路径的真实投入。</p>

      <h2>中国家长怎么选？</h2>
      <p>如果家长正在比较 ${escapeHtml(school.nameZh)}，建议同时准备三类问题：</p>
      <ol>
        <li>孩子当前英文能力是否能支撑这类学校的课堂节奏？</li>
        <li>这所学校的课程路径，是否匹配未来大学方向？</li>
        <li>如果第一选择不成功，是否已经准备好同类型或更稳妥的备选学校？</li>
      </ol>
      <p>真正稳妥的选校，不是只选“最有名”的学校，而是把目标学校、保底学校和路径选择放在一起看。</p>

      ${faq.html}

      <section class="related-section">
        <h2>继续了解相关路径</h2>
        <div class="quick-links">${related.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('')}</div>
      </section>

      <section class="contact-section" id="contact" aria-labelledby="contact-title">
        <div>
          <p class="eyebrow">免费咨询</p>
          <h2 id="contact-title">想判断 ${escapeHtml(school.nameZh)} 是否适合孩子？</h2>
          <p>告诉我们孩子年龄、英文基础和目标路径，SEDA 顾问会帮你比较更合适的学校和升学方案。</p>
        </div>
        <form class="lead-form">
          <label><span>学生当前年级</span><input type="text" name="grade" placeholder="例如：国内初二 / 小五 / 高一" /></label>
          <label><span>目标学校</span><input type="text" name="target" value="${escapeHtml(school.nameZh)}" /></label>
          <label><span>联系方式</span><input type="text" name="contact" placeholder="微信 / WhatsApp / 手机" /></label>
          <button class="primary-button" type="submit">提交咨询</button>
        </form>
      </section>
    </article>
    <aside class="sidebar">
      <div class="sidebar-card"><h3>学校信息</h3><ul>
        <li><a href="/${school.basePath}/">${escapeHtml(school.categoryLabel)}总览</a></li>
        ${related.slice(0, 3).map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join('')}
      </ul></div>
      <div class="sidebar-card cta-card"><h3>免费选校咨询</h3><p>想比较 ${escapeHtml(school.nameZh)} 和其他学校？联系 SEDA。</p><a class="btn" href="/contact/">预约咨询</a></div>
    </aside>
  </div>
</main>
${footer}
<script src="/seda-site.js?v=16"></script>
</body>
</html>`;
}

export function buildSchoolPages() {
  if (!fs.existsSync(dataFile)) return 0;
  const home = read(path.join(root, 'index.html'));
  const header = between(home, '<header class="site-header">', '</header>');
  const footer = between(home, '<footer class="site-footer">', '</footer>');
  const schools = JSON.parse(read(dataFile));
  for (const school of schools) {
    const url = schoolUrl(school);
    const dir = path.join(root, url);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPage(school, header, footer), 'utf8');
  }
  return schools.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = buildSchoolPages();
  console.log(`Built ${count} school SEO pages.`);
}
