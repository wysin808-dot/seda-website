import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const headMarkerStart = '<!-- SEDA_KEY_SEO_START -->';
const headMarkerEnd = '<!-- SEDA_KEY_SEO_END -->';
const bodyMarkerStart = '<!-- SEDA_GEO_BODY_START -->';
const bodyMarkerEnd = '<!-- SEDA_GEO_BODY_END -->';

function escapeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function slugId(value = '') {
  return String(value)
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replaceAll('/', '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'home';
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, html) {
  fs.writeFileSync(file, html, 'utf8');
}

function stripExisting(html) {
  const headPattern = new RegExp(`${headMarkerStart}[\\s\\S]*?${headMarkerEnd}\\n?`, 'g');
  const bodyPattern = new RegExp(`${bodyMarkerStart}[\\s\\S]*?${bodyMarkerEnd}\\n?`, 'g');
  return html.replace(headPattern, '').replace(bodyPattern, '');
}

function injectHead(html, block) {
  if (!html.includes('</head>')) throw new Error('Missing </head> in key SEO page');
  return html.replace('</head>', `${block}\n</head>`);
}

function injectBody(html, block, page) {
  const mainIndex = html.indexOf('<main');
  const sectionEndIndex = mainIndex === -1 ? -1 : html.indexOf('</section>', mainIndex);
  if (mainIndex === -1 || sectionEndIndex === -1) {
    throw new Error(`Missing first hero section in ${page.file}`);
  }
  const insertIndex = sectionEndIndex + '</section>'.length;
  return `${html.slice(0, insertIndex)}\n${block}${html.slice(insertIndex)}`;
}

function buildHeadBlock(page) {
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
    knowsAbout: page.about,
    audience: {
      '@type': 'Audience',
      audienceType: '中国家长、国际学生、新加坡升学家庭',
    },
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
  const aiSummary = page.summary.map((item) => `<meta name="ai-summary" content="${escapeHtml(item)}"/>`).join('\n');
  return `${headMarkerStart}
<meta name="robots" content="index,follow,max-image-preview:large"/>
<meta name="googlebot" content="index,follow"/>
<meta name="bingbot" content="index,follow"/>
${aiSummary}
<script type="application/ld+json">${escapeJson(webPage)}</script>
<script type="application/ld+json">${escapeJson(itemList)}</script>
<script type="application/ld+json">${escapeJson(faq)}</script>
${headMarkerEnd}`;
}

function buildBodyBlock(page) {
  const id = slugId(page.path);
  // NOTE: the keyword-stuffing "主题标签"(seo-tags) section was intentionally
  // removed — visible tag clouds triggered a Baidu quality penalty. Only the
  // readable GEO summary is injected now.
  const content = `<section class="geo-summary core-geo-summary" aria-labelledby="geo-summary-${id}">
        <p class="eyebrow">GEO 可读答案</p>
        <h2 id="geo-summary-${id}">${escapeHtml(page.geoTitle || `${page.title}核心结论`)}</h2>
        <ul>
${page.summary.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n')}
        </ul>
      </section>`;
  const body = page.compactBody
    ? `      <div class="${escapeHtml(page.compactBody)}" aria-label="${escapeHtml(page.title)}页面核心摘要">
      ${content}
      </div>`
    : `      ${content}`;
  return `${bodyMarkerStart}
${body}
${bodyMarkerEnd}`;
}

function enhancePageHtml(page, html) {
  const clean = stripExisting(html);
  const withHead = injectHead(clean, buildHeadBlock(page));
  return injectBody(withHead, buildBodyBlock(page), page);
}

const pages = [
  // NOTE: /wace/ is intentionally excluded — it is a fully hand-built static
  // page with its own structured data and content, so it must NOT be enhanced
  // (the injected geo-summary / seo-tags blocks are unwanted there).
  {
    path: '/wace-vs-a-level/',
    file: 'wace-vs-a-level/index.html',
    title: 'WACE vs A-Level 怎么选',
    description: '对比 WACE 与 A-Level 的课程难度、英文要求、考试方式、大学认可度和中国学生适配度。',
    about: ['WACE vs A-Level', 'A-Level', 'ATAR', '国际高中选课', '中国学生升学', 'NUS 申请', 'NTU 申请'],
    summary: [
      'WACE 和 A-Level 都能申请大学，但考试结构、评分方式、选课压力和适合学生类型不同。',
      '数学基础较好、希望路径更灵活的学生可以重点比较 WACE；学术冲刺能力强的学生可考虑 A-Level。',
      '选择课程时不要只看名气，应同时看孩子英文水平、目标专业、备考时间和学校教学资源。',
    ],
    links: [
      { name: 'WACE 课程总览', url: '/wace/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: 'WACE ATAR', url: '/wace-atar/' },
      { name: '升学路径总览', url: '/pathway/' },
    ],
    faq: [
      { q: 'WACE 和 A-Level 哪个更难？', a: '难度取决于学生基础。A-Level 单科深度更强，WACE 更强调课程组合、校内评估和 ATAR 排名。' },
      { q: '申请新加坡大学 WACE 会不会吃亏？', a: '不会简单因为课程名称吃亏，大学主要看成绩、科目要求、专业竞争和申请材料。' },
      { q: '中国学生更适合 WACE 还是 A-Level？', a: '如果英文和学术抗压能力强，可看 A-Level；如果希望更灵活、更重视数学和过渡支持，可重点看 WACE。' },
    ],
  },
  {
    path: '/wace-atar/',
    file: 'wace-atar/index.html',
    title: 'WACE ATAR 成绩与大学申请',
    description: '解释 WACE ATAR 的含义、计算逻辑、科目组合、目标分数和申请新加坡、澳洲、香港大学的参考方式。',
    about: ['WACE ATAR', 'ATAR 分数', '大学申请', 'WACE 科目组合', '新加坡大学申请', '澳洲八大', '香港大学申请'],
    summary: [
      'ATAR 不是百分制分数，而是澳洲大学录取使用的排名指标，直接影响大学和专业选择。',
      '中国学生准备 WACE 时，要把目标大学专业反推到 ATAR 目标和科目组合上。',
      '本页应承接 WACE 课程页，并导向 NUS/NTU、澳洲大学、香港大学申请相关页面。',
    ],
    links: [
      { name: 'WACE 课程总览', url: '/wace/' },
      { name: 'WACE 申请 NUS / NTU', url: '/wace-nus-ntu/' },
      { name: '新加坡公立大学', url: '/university/' },
      { name: '升学路径总览', url: '/pathway/' },
    ],
    faq: [
      { q: 'ATAR 是什么？', a: 'ATAR 是 Australian Tertiary Admission Rank，表示学生在同龄申请者中的相对排名。' },
      { q: 'ATAR 越高越好吗？', a: '是，但还要满足专业科目要求。医学、法律、计算机等热门方向通常竞争更高。' },
      { q: 'WACE 成绩可以申请哪些地区大学？', a: '常见目标包括新加坡、澳洲、英国、香港、新西兰和部分加拿大大学。' },
    ],
  },
  {
    path: '/wace-nus-ntu/',
    file: 'wace-nus-ntu/index.html',
    title: 'WACE 申请 NUS/NTU 指南',
    description: '面向中国学生的 WACE 申请新加坡国立大学、南洋理工大学攻略，覆盖 ATAR、科目要求、专业选择和申请策略。',
    about: ['WACE 申请 NUS', 'WACE 申请 NTU', '新加坡国立大学', '南洋理工大学', 'ATAR 要求', '本科申请', '中国学生申请'],
    summary: [
      'WACE 可以作为申请 NUS/NTU 的国际高中成绩之一，但不同专业对 ATAR 和科目有具体要求。',
      '申请新加坡公立大学不能只看最低分，热门专业还要看竞争、英文、数学和背景材料。',
      '本页需要与 WACE、ATAR、NUS、NTU、公立大学总览页面互相连接，形成申请路径闭环。',
    ],
    links: [
      { name: 'WACE 课程总览', url: '/wace/' },
      { name: 'WACE ATAR', url: '/wace-atar/' },
      { name: '新加坡国立大学', url: '/university/nus/' },
      { name: '南洋理工大学', url: '/university/ntu/' },
    ],
    faq: [
      { q: 'WACE 能申请 NUS 吗？', a: '可以作为国际高中成绩申请，但需满足对应专业的分数、科目和英文要求。' },
      { q: 'WACE 能申请 NTU 吗？', a: '可以，NTU 同样会看 ATAR、科目匹配、专业竞争和申请材料。' },
      { q: '申请 NUS/NTU 要提前多久准备？', a: '建议至少提前一年规划科目、成绩目标和材料，Year 12 阶段要密切关注申请窗口。' },
    ],
  },
  {
    path: '/aeis/',
    file: 'aeis/index.html',
    title: 'AEIS 考试攻略',
    description: '面向中国学生的新加坡 AEIS 入学考试攻略，覆盖年龄、英文、数学、备考时间线、政府中小学入学路径和家长常见问题。',
    about: ['AEIS', 'S-AEIS', '新加坡政府学校', '国际学生入学考试', '小学插班', '中学插班', 'AEIS 英文', 'AEIS 数学'],
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
  // NOTE: /o-level/ excluded — now a fully hand-built static page with its own
  // structured data and content; must NOT be enhanced (avoids injected blocks).
  {
    path: '/o-level-jc/',
    file: 'o-level-jc/index.html',
    title: 'O-Level 申请 JC 指南',
    description: '新加坡 O-Level 申请 JC 中文指南，覆盖 L1R5、初级学院选择、A-Level 出口和中国学生规划重点。',
    about: ['O-Level 申请 JC', 'JC 初级学院', 'L1R5', 'A-Level', '新加坡高中', '公立大学路径', '中国学生升学'],
    summary: [
      'O-Level 申请 JC 的核心是 L1R5、科目要求、学校竞争和未来 A-Level 出口。',
      'JC 路线适合学术能力强、英文适应较好、目标新加坡公立大学或英联邦大学的学生。',
      '本页需要连接 O-Level、A-Level、JC 数据库、公立大学和升学路径页面。',
    ],
    links: [
      { name: 'O-Level 课程总览', url: '/o-level/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: 'JC 学校数据库', url: '/jc/' },
      { name: '新加坡公立大学', url: '/university/' },
    ],
    faq: [
      { q: 'O-Level 进 JC 难吗？', a: '热门 JC 竞争较强，主要看 L1R5、科目要求和当年录取情况。' },
      { q: '进 JC 后一定更容易上大学吗？', a: '不一定。JC 的 A-Level 压力较高，适合学术型学生，后续仍要看成绩和专业竞争。' },
      { q: '中国学生适合 JC 吗？', a: '如果英文、数学和自主学习能力较强，且目标公立大学，JC 是值得考虑的路线。' },
    ],
  },
  {
    path: '/o-level-poly/',
    file: 'o-level-poly/index.html',
    title: 'O-Level 申请 Poly 指南',
    description: '新加坡 O-Level 申请理工学院攻略，覆盖 ELR2B2、专业选择、五所 Poly、升大学路径和中国学生适配度。',
    about: ['O-Level 申请 Poly', 'Poly 理工学院', 'ELR2B2', 'Diploma', '应用型专业', 'Poly 升大学', '中国学生选专业'],
    summary: [
      'O-Level 申请 Poly 的关键不是只选学校，而是根据成绩、兴趣、专业和未来大学方向选择 Diploma。',
      'Poly 路线更应用型，适合希望尽早接触专业方向和实践项目的学生。',
      '本页应连接五所 Poly、O-Level、专业选择、大学升学和就业导向页面。',
    ],
    links: [
      { name: 'O-Level 课程总览', url: '/o-level/' },
      { name: '新加坡理工学院', url: '/poly/sp/' },
      { name: '义安理工学院', url: '/poly/np/' },
      { name: '淡马锡理工学院', url: '/poly/tp/' },
      { name: 'Poly 数据库', url: '/poly/' },
    ],
    faq: [
      { q: 'O-Level 申请 Poly 看什么？', a: '主要看 ELR2B2、科目要求、专业竞争和学校提供的课程方向。' },
      { q: 'Poly 以后还能升大学吗？', a: '可以。学生可用 Diploma 成绩申请新加坡本地大学、海外大学或转入相关专业。' },
      { q: 'Poly 适合中国学生吗？', a: '适合目标专业明确、喜欢实践课程、希望较早进入专业领域的学生。' },
    ],
  },
  {
    path: '/a-level/',
    file: 'a-level/index.html',
    title: '新加坡 A-Level 课程与申请指南',
    description: '新加坡 A-Level 中文指南，覆盖 JC、私立 A-Level、科目选择、考试难度、公立大学申请和中国学生适配度。',
    about: ['A-Level', '新加坡 A-Level', 'JC', 'H1 H2 H3 科目', '英联邦大学申请', 'NUS 申请', 'NTU 申请'],
    summary: [
      'A-Level 是新加坡 JC 体系和英联邦大学申请的重要课程，学术深度和考试压力都较高。',
      '中国学生选择 A-Level 时，要判断英文、人文、科学和数学组合是否能支撑目标专业。',
      '本页应连接 JC、O-Level 申请 JC、公立大学、WACE 对比和升学路径页面。',
    ],
    links: [
      { name: 'O-Level 申请 JC', url: '/o-level-jc/' },
      { name: 'JC 数据库', url: '/jc/' },
      { name: 'WACE vs A-Level', url: '/wace-vs-a-level/' },
      { name: '新加坡公立大学', url: '/university/' },
    ],
    faq: [
      { q: '新加坡 A-Level 难吗？', a: '难度较高，尤其对英文写作、人文表达、科学深度和长期备考稳定性要求较高。' },
      { q: 'A-Level 适合什么学生？', a: '适合学术能力强、目标公立大学或英联邦大学，并能承受高强度考试压力的学生。' },
      { q: 'A-Level 和 WACE 怎么选？', a: 'A-Level 更偏高强度学术考试，WACE 更强调 ATAR 和课程组合，需要根据学生基础和目标专业判断。' },
    ],
  },
  {
    path: '/ib/',
    file: 'ib/index.html',
    title: 'IB 课程与新加坡国际学校指南',
    description: '新加坡 IB 课程中文指南，覆盖 IBDP、国际学校、课程难度、大学认可度、选课和中国学生适配度。',
    about: ['IB 课程', 'IBDP', '新加坡国际学校', 'TOK', 'EE', 'CAS', '全球大学申请', '国际课程'],
    summary: [
      'IB 是全球认可度高的国际课程，适合综合能力强、英文基础好、目标多地区大学申请的学生。',
      'IB 的难点不只是考试，还包括论文、项目、时间管理和持续评估。',
      '本页应连接国际学校、A-Level、WACE、AP 和大学申请页面，帮助家长横向比较。',
    ],
    links: [
      { name: '国际学校指南', url: '/international-school/' },
      { name: 'WACE 课程', url: '/wace/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: 'AP 课程', url: '/ap/' },
    ],
    faq: [
      { q: 'IB 适合中国学生吗？', a: '适合英文能力强、综合学习能力好、能适应项目制和论文写作的学生。' },
      { q: 'IB 和 A-Level 最大区别是什么？', a: 'A-Level 更偏科目深度和考试，IB 更重综合能力、论文、项目和持续评估。' },
      { q: '新加坡哪些学校有 IB？', a: '多所国际学校和部分本地学校提供 IB 课程，具体要看年级、学额和申请要求。' },
    ],
  },
  {
    path: '/ap/',
    file: 'ap/index.html',
    title: 'AP 课程与美国大学申请指南',
    description: '新加坡 AP 课程中文指南，覆盖 AP 科目、美国大学申请、国际学校选择、考试规划和中国学生适配度。',
    about: ['AP 课程', '美国大学申请', '新加坡国际学校', 'AP 科目选择', 'SAT', 'ACT', '国际课程'],
    summary: [
      'AP 更适合目标美国大学或希望补强学科竞争力的学生，通常与高中成绩和标化规划一起看。',
      '中国学生选择 AP 时，要关注学校课程供给、考试时间线、目标专业和活动背景。',
      '本页应连接国际学校、IB、A-Level、升学路径和美国大学申请相关内容。',
    ],
    links: [
      { name: '国际学校指南', url: '/international-school/' },
      { name: 'IB 课程', url: '/ib/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: '升学路径总览', url: '/pathway/' },
    ],
    faq: [
      { q: 'AP 是什么课程？', a: 'AP 是美国大学先修课程和考试体系，可用于展示学科能力，并可能获得部分大学学分。' },
      { q: 'AP 适合申请新加坡大学吗？', a: '部分学校和专业会参考 AP，但如果目标是新加坡公立大学，还要看完整高中成绩和具体要求。' },
      { q: 'AP 和 IB 怎么选？', a: 'AP 更灵活、偏单科强化；IB 更体系化、综合要求更高。' },
    ],
  },
  {
    path: '/foundation/',
    file: 'foundation/index.html',
    title: '新加坡 Foundation 预科课程指南',
    description: '新加坡 Foundation 预科中文指南，覆盖适合学生、申请条件、大学衔接、风险判断和中国学生规划建议。',
    about: ['Foundation 预科', '大学预科', '新加坡私立教育', '国际学生升学', '本科衔接', '中国学生申请'],
    summary: [
      'Foundation 预科适合需要补足学术或英文基础，并希望衔接本科或国际课程的学生。',
      '家长选择预科时，要重点看衔接大学、录取条件、升学率和课程是否真正匹配目标。',
      '本页应与 WACE、A-Level、国际学校、大学申请和留学路径页面形成互补。',
    ],
    links: [
      { name: '升学路径总览', url: '/pathway/' },
      { name: 'WACE 课程', url: '/wace/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: '新加坡公立大学', url: '/university/' },
    ],
    faq: [
      { q: 'Foundation 是什么？', a: 'Foundation 通常是大学预科或衔接课程，帮助学生补足进入本科前的学术和英文要求。' },
      { q: 'Foundation 一定能进大学吗？', a: '不一定。要看课程衔接协议、成绩要求、出勤、英文能力和目标专业竞争。' },
      { q: '中国学生什么时候适合读预科？', a: '当学生暂时不满足直接入读高中或本科要求，但目标明确、愿意用一年左右补基础时可考虑。' },
    ],
  },
  {
    path: '/pathway/',
    file: 'pathway/index.html',
    title: '中国学生新加坡升学路径总览',
    description: '中国学生新加坡留学路径攻略，覆盖 AEIS、O-Level、WACE、A-Level、IB、Poly、JC、大学申请和年龄段选择。',
    about: ['新加坡升学路径', '中国学生留学新加坡', 'AEIS', 'O-Level', 'WACE', 'A-Level', 'IB', 'Poly', 'JC'],
    summary: [
      '中国学生规划新加坡留学，应先按年龄、英文水平、目标大学和预算确定路径，再选择学校。',
      '低龄可重点看 AEIS 和政府学校，中学阶段可比较 O-Level、WACE、A-Level、IB 和国际学校。',
      '本页是全站路径中枢，需要向课程、学校数据库、大学、留学指南和 AI 工具分发内链。',
    ],
    links: [
      { name: 'AEIS 考试攻略', url: '/aeis/' },
      { name: 'O-Level 课程', url: '/o-level/' },
      { name: 'WACE 课程', url: '/wace/' },
      { name: '国际学校指南', url: '/international-school/' },
      { name: 'AI 升学规划', url: '/tools/' },
    ],
    faq: [
      { q: '中国学生去新加坡留学先看什么？', a: '先看年龄、英文水平、目标大学和预算，再判断适合政府学校、国际学校还是私立国际高中路径。' },
      { q: '新加坡升学路径有几种？', a: '常见路径包括 AEIS 进政府学校、O-Level 到 JC/Poly、WACE/IB/A-Level 国际课程和大学预科等。' },
      { q: '什么时候最需要做规划？', a: '小学高年级、初二到高一阶段尤其关键，因为路径切换和考试准备时间会明显影响结果。' },
    ],
  },
  {
    path: '/international-school/',
    file: 'international-school/index.html',
    title: '新加坡国际学校选校指南',
    description: '新加坡国际学校中文指南，覆盖 IB、IGCSE、A-Level、AP、WACE、学费、申请、课程体系和中国学生选校策略。',
    about: ['新加坡国际学校', 'IB 国际学校', 'IGCSE', 'A-Level 国际学校', 'AP 课程', 'WACE 国际高中', '国际学校学费'],
    summary: [
      '新加坡国际学校选择不能只看排名，要同时比较课程体系、学费、国籍比例、英文支持和大学出口。',
      '中国学生常见课程包括 IB、IGCSE/A-Level、AP 和 WACE，不同课程适合不同目标大学和学习风格。',
      '本页应连接国际学校数据库、课程体系页面、留学费用、学生准证和升学路径页面。',
    ],
    links: [
      { name: '国际学校列表', url: '/international-school/schools/' },
      { name: 'IB 课程', url: '/ib/' },
      { name: 'A-Level 课程', url: '/a-level/' },
      { name: 'WACE 课程', url: '/wace/' },
      { name: '留学费用', url: '/guides/cost/' },
    ],
    faq: [
      { q: '新加坡国际学校怎么选？', a: '重点看课程体系、学费预算、英文支持、大学出口、地理位置和孩子适应能力。' },
      { q: '国际学校一定比政府学校好吗？', a: '不一定。国际学校更国际化、课程选择多，但费用高；政府学校本地体系强、费用低，但入学和适应压力大。' },
      { q: '中国学生适合 IB 还是 A-Level？', a: 'IB 适合综合能力和英文较强的学生，A-Level 适合科目优势明确、目标英联邦大学的学生。' },
    ],
  },
  {
    path: '/school-database/',
    file: 'school-database/index.html',
    title: '新加坡学校数据库总览',
    description: '新加坡学校数据库入口，覆盖政府小学、政府中学、JC、Poly、公立大学、国际学校和私立学校页面。',
    about: ['新加坡学校数据库', '政府小学', '政府中学', 'JC', 'Poly', '公立大学', '国际学校', '私立学校'],
    summary: [
      '学校数据库是 SEDA 长尾 SEO 的核心资产，适合承接学校名、地区、课程和申请问题搜索。',
      '中国家长选校时，应从学校类型、课程出口、地理位置、学费和孩子适配度综合判断。',
      '本页需要向小学、中学、JC、Poly、大学、国际学校和私立学校详情页分发权重。',
    ],
    links: [
      { name: '政府小学', url: '/primary-schools/' },
      { name: '政府中学', url: '/secondary-schools/' },
      { name: 'JC 初级学院', url: '/jc/' },
      { name: 'Poly 理工学院', url: '/poly/' },
      { name: '国际学校', url: '/international-school/schools/' },
    ],
    faq: [
      { q: 'SEDA 学校数据库包括哪些学校？', a: '包括政府小学、政府中学、JC、Poly、公立大学、国际学校和部分私立学校。' },
      { q: '学校页面适合做 SEO 吗？', a: '适合。学校名、地区、课程、申请要求和学费都是长尾搜索的重要入口。' },
      { q: '选校应该先看排名吗？', a: '不建议只看排名，应结合课程、孩子能力、交通、预算、出口和申请难度综合判断。' },
    ],
  },
  {
    path: '/guides/student-pass/',
    file: 'guides/student-pass/index.html',
    title: '新加坡学生准证申请指南',
    description: '新加坡 Student Pass 学生准证中文指南，覆盖申请流程、材料、时间线、常见拒签原因和中国学生家长注意事项。',
    about: ['新加坡学生准证', 'Student Pass', 'ICA', '留学签证', '中国学生申请', '陪读准证', '入境新加坡'],
    summary: [
      '学生准证是中国学生在新加坡合法全日制学习的重要文件，通常需要学校录取后进入申请流程。',
      '家长应提前准备护照、录取文件、出生证明、资金和家庭资料，避免因材料不一致拖慢进度。',
      '本页应连接陪读准证、住宿、费用、入学路径和联系咨询页面，承接签证类长尾搜索。',
    ],
    links: [
      { name: '陪读准证', url: '/guides/dependent-pass/' },
      { name: '留学费用', url: '/guides/cost/' },
      { name: '住宿方案', url: '/guides/accommodation/' },
      { name: '升学路径总览', url: '/pathway/' },
      { name: '联系我们', url: '/contact/' },
    ],
    faq: [
      { q: '新加坡学生准证什么时候申请？', a: '通常在获得学校录取后申请，具体时间要看学校、课程开学日期和 ICA 审核进度。' },
      { q: '学生准证容易被拒吗？', a: '材料不完整、信息不一致、学校或课程不匹配、资金和家庭资料问题都可能影响审核。' },
      { q: '家长可以陪读吗？', a: '部分低龄学生家庭可考虑陪读准证，但需要符合新加坡相关条件和申请要求。' },
    ],
  },
];

export function enhanceKeySeoPages() {
  let count = 0;
  for (const page of pages) {
    const file = path.join(root, page.file);
    if (!fs.existsSync(file)) continue;
    write(file, enhancePageHtml(page, read(file)));
    count += 1;
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Enhanced ${enhanceKeySeoPages()} key SEO pages.`);
}
