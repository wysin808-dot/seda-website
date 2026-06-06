import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const domain = 'https://sgeda.org.cn';
const buildDate = new Date().toISOString().slice(0, 10);
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
    university: '公立大学阶段决定的是专业方向、就业城市、研究机会和长期身份规划。对中国学生来说，新加坡大学不是只看排名，而是要看申请路径、专业匹配和毕业后的发展空间。',
    artsUniversity: '艺术大学路径更看重作品集、创作能力、面试表达和长期行业积累。它不适合只用传统分数逻辑判断，更适合有清晰艺术、设计、表演或创意产业方向的学生。',
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
  if (school.type === 'university') {
    return '新加坡公立大学申请通常可以通过新加坡 A-Level、IB、Poly Diploma、国际课程或中国高考等路径进行。不同大学和专业要求差异很大，尤其是医学、法律、计算机、商科、建筑、设计等方向，需要提前核对官方入学要求。';
  }
  if (school.type === 'artsUniversity') {
    return '新加坡艺术大学路径通常需要看学历背景、作品集、面试、英文能力和具体专业要求。艺术、设计、音乐、表演、电影、艺术管理等方向，申请逻辑和普通综合大学不同，家长要提前准备作品集时间线。';
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
  if (school.type === 'university' || school.type === 'artsUniversity') {
    return '大学阶段费用要分开看学费、生活费、住宿、保险、材料或项目支出。国际学生费用通常高于本地学生，部分专业费用差异明显，最终应以学校当年官方收费表为准。';
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
    university: [
      ['新加坡公立大学总览', '/university/'],
      ['中国学生升学路径', '/pathway/'],
      ['Poly 升大学路径', '/poly/'],
      ['A-Level 课程', '/a-level/'],
    ],
    artsUniversity: [
      ['新加坡公立大学总览', '/university/'],
      ['国际学校总览', '/international-school/'],
      ['学生准证申请', '/guides/student-pass/'],
      ['留学费用', '/guides/cost/'],
    ],
    international: [
      ['国际学校总览', '/international-school/'],
      ['国际学校 SEO 学校库', '/international-school/schools/'],
      ['IB 课程', '/ib/'],
      ['WACE 课程', '/wace/'],
      ['新加坡国际学校费用', '/international-school/singapore-international-school-fees/'],
    ],
  };
  return links[school.type] || [['学校数据库', '/school-database/'], ['留学指南', '/guides/']];
}

function isHigherEducation(school) {
  return school.type === 'university' || school.type === 'artsUniversity' || school.type === 'poly';
}

function schemaType(school) {
  if (school.type === 'university' || school.type === 'artsUniversity') return 'CollegeOrUniversity';
  if (school.type === 'international') return 'School';
  return 'EducationalOrganization';
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function textIncludes(school, keyword) {
  return [
    school.nameZh,
    school.nameEn,
    school.schoolType,
    school.curriculum,
    school.location,
    school.audience,
    school.angle,
    ...(school.features || []),
    ...(school.majorAreas || []),
    ...(school.admissionPaths || []),
  ].join(' ').toLowerCase().includes(String(keyword).toLowerCase());
}

function textMatches(school, pattern) {
  return pattern.test([
    school.nameZh,
    school.nameEn,
    school.schoolType,
    school.curriculum,
    school.location,
    school.audience,
    school.angle,
    ...(school.features || []),
    ...(school.majorAreas || []),
    ...(school.admissionPaths || []),
  ].join(' '));
}

function seoTagsForSchool(school) {
  const tags = [
    school.categoryLabel,
    school.curriculum,
    school.schoolType,
    school.location ? `${school.location}择校` : '',
    '适合中国学生',
    '新加坡择校',
    '英文学习环境',
  ];

  const typeTags = {
    primary: ['政府小学', 'PSLE', 'AEIS 备考', '低龄留学', '小学选校'],
    secondary: ['政府中学', 'O-Level', 'SEC 中学', 'AEIS/S-AEIS', 'JC/Poly 路径'],
    jc: ['JC 初级学院', 'A-Level', '公立大学路径', 'O-Level 升学'],
    poly: ['Poly 理工学院', 'Diploma 文凭', 'O-Level 申请 Poly', '应用型专业', 'Poly 升大学'],
    university: ['新加坡公立大学', '本科申请', '中国学生申请', '大学专业选择', '就业导向'],
    artsUniversity: ['艺术大学', '作品集申请', '设计艺术专业', '创意产业', '面试准备'],
    international: ['国际学校', '国际课程', '大学申请方向', '国际学校学费', '入学评估'],
  };
  tags.push(...(typeTags[school.type] || []));

  const curriculumRules = [
    ['IB', ['IB 课程', 'IBDP', '探究式学习']],
    ['IGCSE', ['IGCSE', 'Cambridge 课程']],
    ['A-Level', ['A-Level', '英联邦大学申请']],
    [/\bAP\b|Advanced Placement/i, ['AP 课程', '美国大学申请']],
    ['WACE', ['WACE 课程', 'ATAR']],
    ['O-Level', ['O-Level', 'O水准']],
    ['Cambridge', ['Cambridge 课程', 'IGCSE 衔接']],
    ['CBSE', ['CBSE', '印度课程']],
    ['英国', ['英国课程', '英式教育']],
    ['美国', ['美国课程', 'AP 方向']],
    ['澳洲', ['澳洲课程', '澳洲大学方向']],
  ];

  for (const [needle, matchedTags] of curriculumRules) {
    const matched = needle instanceof RegExp ? textMatches(school, needle) : textIncludes(school, needle);
    if (matched) tags.push(...matchedTags);
  }

  if (textIncludes(school, '费用相对友好') || textIncludes(school, '性价比')) tags.push('费用相对友好');
  if (textIncludes(school, '寄宿')) tags.push('寄宿选择');
  if (textIncludes(school, '女校')) tags.push('女校');
  if (textIncludes(school, '男校')) tags.push('男校');
  if (textIncludes(school, 'SAP')) tags.push('SAP 特选学校');
  if (textIncludes(school, 'IP')) tags.push('IP 直通车');
  if (textIncludes(school, '学习支持') || textIncludes(school, '特殊教育')) tags.push('学习支持');
  if (textIncludes(school, '小班') || textIncludes(school, '小规模')) tags.push('小班教学');
  if (textIncludes(school, '中文') || textIncludes(school, '华文') || textIncludes(school, '双语')) tags.push('中文/双语环境');

  return unique(tags).slice(0, 18);
}

function knowsAboutForSchool(school, tags) {
  return unique([
    ...tags,
    school.nameZh,
    school.nameEn,
    '新加坡教育',
    '新加坡留学',
    '中国学生升学',
    '学校申请',
    '学生准证',
  ]).slice(0, 28);
}

function renderSeoTagBlock(school, tags) {
  return `<section class="seo-tags" aria-labelledby="seo-tags-title">
        <p class="eyebrow">选校标签</p>
        <h2 id="seo-tags-title">${escapeHtml(school.nameZh)}的 SEO/GEO 关键信息</h2>
        <p>这些标签用于帮助家长快速判断学校定位，也帮助搜索引擎和 AI 搜索理解本页主题。</p>
        <div class="seo-tag-cloud">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      </section>`;
}

function quickAnswerForSchool(school) {
  const pathMap = {
    primary: 'AEIS / S-AEIS、政府小学入学、PSLE 和后续政府中学路径',
    secondary: 'AEIS / S-AEIS、O-Level、IP、JC 或 Poly 路径',
    jc: 'O-Level 后申请 JC、A-Level 选科、公立大学申请路径',
    poly: 'O-Level 申请 Poly、Diploma 专业选择、Poly 升大学路径',
    university: 'A-Level、IB、Poly Diploma、中国高考或国际课程申请本科',
    artsUniversity: '作品集、面试、英文要求和艺术设计类专业申请',
    international: '国际课程、入学测评、英文过渡和未来大学申请方向',
  };
  return `${school.nameZh}（${school.nameEn}）是${school.location ? `位于 ${school.location} 的` : ''}${school.schoolType || school.categoryLabel}，主要关联 ${school.curriculum || school.categoryLabel}。对中国学生来说，判断它是否适合，重点不是只看名气，而是看孩子英文基础、年龄阶段、家庭预算、目标课程和后续升学路径是否匹配。常见规划方向包括${pathMap[school.type] || '新加坡选校、课程衔接和长期升学路径'}。`;
}

function renderQuickAnswerBlock(school) {
  return `<section class="geo-summary" aria-labelledby="school-quick-answer">
        <p class="eyebrow">快速答案</p>
        <h2 id="school-quick-answer">${escapeHtml(school.nameZh)}适合中国学生吗？</h2>
        <p>${escapeHtml(quickAnswerForSchool(school))}</p>
        <ul>
          <li>学校定位：${escapeHtml(school.schoolType || school.categoryLabel)}</li>
          <li>课程路径：${escapeHtml(school.curriculum || '以学校官方课程为准')}</li>
          <li>位置区域：${escapeHtml(school.location || '新加坡')}</li>
          <li>适合家庭：${escapeHtml(school.audience || '正在比较新加坡学校和升学路径的中国家庭')}</li>
        </ul>
      </section>`;
}

function renderApplicationChecklist(school) {
  const checklist = {
    primary: ['确认孩子年龄和对应年级是否符合 AEIS / S-AEIS 要求', '评估英文阅读、写作和数学英文题适应度', '准备政府小学之外的备选学校和国际学校路径'],
    secondary: ['判断 O-Level、IP 或 AEIS 路径是否匹配', '提前补英文写作、阅读速度和科学/数学英文表达', '同时比较政府中学、国际学校和私立预备课程'],
    jc: ['确认 O-Level 或 IP 成绩是否支持 JC 路径', '提前规划 A-Level 科目组合和大学专业方向', '评估学生是否适合高强度学术环境'],
    poly: ['确认 O-Level 科目成绩和目标专业要求', '比较专业课程内容、实习方向和大学衔接', '不要只按学校名气选择 Poly 专业'],
    university: ['核对目标专业对 A-Level、IB、高考或 Poly 成绩的要求', '准备英文、文书、面试或作品材料', '同时评估专业就业方向和长期发展城市'],
    artsUniversity: ['提前准备作品集主题、项目说明和面试表达', '核对专业对学历、英文和创作经历的要求', '预留足够时间打磨作品而不是临时拼材料'],
    international: ['确认年级名额、英文测评和入学面试要求', '比较课程体系是否匹配未来大学国家', '把学费、注册费、校车、餐费和活动费一起预算'],
  };
  const items = checklist[school.type] || ['确认入学要求和年级名额', '评估英文能力和课程适应度', '准备同类型备选学校'];
  return `<section class="geo-summary" aria-labelledby="school-checklist">
        <p class="eyebrow">申请核对</p>
        <h2 id="school-checklist">申请${escapeHtml(school.nameZh)}前要确认什么？</h2>
        <ol>
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ol>
      </section>`;
}

function renderList(title, items = []) {
  if (!items.length) return '';
  return `<h2>${escapeHtml(title)}</h2>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n        ')}
      </ul>`;
}

function renderHigherEducationBlocks(school) {
  if (!isHigherEducation(school)) return '';
  const majorAreas = school.majorAreas || school.features || [];
  const admissionPaths = school.admissionPaths || [];
  const source = school.officialSource ? `<p class="source-note">信息参考：${escapeHtml(school.officialSource)}。课程、费用和申请要求可能更新，正式申请前请以学校官网和 MOE 官方页面为准。</p>` : '';
  return `
      <section class="geo-summary" aria-labelledby="seo-answer-${escapeHtml(school.slug)}">
        <p class="eyebrow">GEO 可读答案</p>
        <h2 id="seo-answer-${escapeHtml(school.slug)}">${escapeHtml(school.nameZh)}适合什么学生？</h2>
        <p>${escapeHtml(school.geoAnswer || school.angle)}</p>
      </section>

      <h2>${escapeHtml(school.nameZh)}在新加坡教育体系里的定位</h2>
      <p>${escapeHtml(school.positioning || school.angle)}</p>
      <p>家长在比较 ${escapeHtml(school.nameZh)} 时，不建议只看“排名”或“名气”。更重要的是专业方向、录取路径、课程强度、毕业出口，以及孩子是否适合这种学习方式。</p>

      ${renderList('主要专业与课程方向', majorAreas)}

      ${renderList('中国学生常见申请路径', admissionPaths)}

      <h2>和中国学生相关的判断重点</h2>
      <p>${escapeHtml(school.chinaStudentNotes || `中国学生选择 ${school.nameZh}，要先判断自己的学历体系是否匹配，包括高考、A-Level、IB、O-Level 后 Poly 路径、WACE 或其他国际课程成绩。`)}</p>
      <p>如果学生目标是新加坡长期发展，还要同时考虑实习机会、行业网络、毕业后就业方向，以及是否适合继续申请研究生。</p>

      <h2>SEDA 给家长的选择建议</h2>
      <p>${escapeHtml(school.sedaAdvice || '建议家长至少准备一所冲刺选择、一所匹配选择和一所稳妥选择。大学和专业选择应放在一起看，不要只用学校名称做判断。')}</p>
      ${source}`;
}

function seoMetaForSchool(school) {
  const zh = school.nameZh;
  const en = school.nameEn;
  const location = school.location ? `${school.location}、` : '';
  const curriculum = school.curriculum ? `${school.curriculum}、` : '';
  const internationalTitle = `${zh}怎么样？学费、申请与课程指南`;
  const meta = {
    primary: {
      title: `${zh}怎么样？${location}PSLE、AEIS与中国学生选校指南`,
      h1: `${zh}怎么样？${location}PSLE与AEIS入学指南`,
      description: `${zh}（${en}）中文择校指南：${location}PSLE路径、AEIS入学、适合学生、费用与中国家长常见问题。`,
    },
    secondary: {
      title: `${zh}怎么样？${location}O-Level/IP、COP与中国学生选校指南`,
      h1: `${zh}怎么样？${location}O-Level/IP、COP与申请指南`,
      description: `${zh}（${en}）中文择校指南：${location}O-Level或IP路径、COP参考、入学申请、适合学生、费用与中国家长常见问题。`,
    },
    jc: {
      title: `${zh}怎么样？${location}A-Level、录取与中国学生升学指南`,
      h1: `${zh}怎么样？${location}A-Level、录取与升学路径指南`,
      description: `${zh}（${en}）中文升学指南：${location}A-Level路径、录取要求、学科选择、公立大学出口与中国学生常见问题。`,
    },
    poly: {
      title: `${zh}怎么样？${curriculum}专业、申请、学费与中国学生指南`,
      h1: `${zh}怎么样？${curriculum}专业、申请与学费指南`,
      description: `${zh}（${en}）中文升学指南：${curriculum}热门专业、O-Level申请、学费预算、大学衔接与中国学生常见问题。`,
    },
    university: {
      title: `${zh}怎么样？${curriculum}申请要求、学费与中国学生指南`,
      h1: `${zh}怎么样？${curriculum}申请要求与学费指南`,
      description: `${zh}（${en}）中文申请指南：${curriculum}热门专业、申请要求、学费预算、录取路径、就业方向与中国学生常见问题。`,
    },
    artsUniversity: {
      title: `${zh}怎么样？${curriculum}作品集、专业与中国学生指南`,
      h1: `${zh}怎么样？${curriculum}作品集、专业与申请指南`,
      description: `${zh}（${en}）中文申请指南：${curriculum}艺术设计专业、作品集准备、申请要求、学费预算与中国学生常见问题。`,
    },
    international: {
      title: internationalTitle,
      h1: `${zh}怎么样？${curriculum}学费与申请指南`,
      description: `${zh}（${en}）中文择校指南：${curriculum}学费预算、入学申请、适合学生、大学方向与中国家长常见问题。`,
    },
  };
  return meta[school.type] || {
    title: `${zh}怎么样？申请、课程与中国学生选校指南`,
    h1: `${zh}怎么样？申请、课程与选校指南`,
    description: `${zh}（${en}）中文择校指南：位置、课程体系、入学路径、适合学生、费用关注点与中国家长常见问题。`,
  };
}

function renderPage(school, header, footer) {
  const url = schoolUrl(school);
  const { title, h1, description } = seoMetaForSchool(school);
  const seoTags = seoTagsForSchool(school);
  const knowsAbout = knowsAboutForSchool(school, seoTags);
  const keywords = unique([school.nameZh, school.nameEn, school.categoryLabel, '新加坡学校', '新加坡择校', '中国学生', '新加坡留学', ...seoTags]).join(',');
  const faq = renderFaq(school);
  const related = relatedLinks(school);
  const features = school.features || [];
  const schoolSchema = {
    '@context': 'https://schema.org',
    '@type': schemaType(school),
    name: school.nameZh,
    alternateName: school.nameEn,
    description,
    url: `${domain}${url}`,
    address: school.location,
    educationalCredentialAwarded: school.curriculum,
    sameAs: school.sameAs,
    about: seoTags.map((tag) => ({ '@type': 'Thing', name: tag })),
    knowsAbout,
    inLanguage: 'zh-CN',
    dateModified: school.updated || buildDate,
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
    dateModified: school.updated || buildDate,
    mainEntity: faq.items.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    headline: h1,
    description,
    url: `${domain}${url}`,
    inLanguage: 'zh-CN',
    dateModified: school.updated || buildDate,
    about: [
      { '@type': schemaType(school), name: school.nameZh, alternateName: school.nameEn },
      ...seoTags.slice(0, 12).map((tag) => ({ '@type': 'Thing', name: tag })),
    ],
    mainEntity: schoolSchema,
    isPartOf: {
      '@type': 'WebSite',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
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
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${domain}${url}"/>
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="${domain}/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v=36"/>
<script type="application/ld+json">${jsonLd(schoolSchema)}</script>
<script type="application/ld+json">${jsonLd(webPageSchema)}</script>
<script type="application/ld+json">${jsonLd(breadcrumbSchema)}</script>
<script type="application/ld+json">${jsonLd(faqSchema)}</script>
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
      ${renderQuickAnswerBlock(school)}

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

      ${renderSeoTagBlock(school, seoTags)}
      ${renderApplicationChecklist(school)}

      <h2>${escapeHtml(school.nameZh)}是什么类型的学校？</h2>
      <p>很多家长第一次搜索 ${escapeHtml(school.nameZh)}，通常不是只想知道学校在哪里，而是想判断：这所学校到底适不适合自己的孩子。</p>
      <p>${escapeHtml(school.angle)}</p>
      <p>${escapeHtml(typeIntro(school))}</p>

      ${renderHigherEducationBlocks(school)}

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
                <ul><li>国际学校推荐</li><li>AEIS 规划</li><li>A-Level 规划</li><li>一对一专业咨询</li></ul>
              </div>
            </div>
          </div>
          <form class="lead-form">
            <label><span>学生当前年级</span><input type="text" name="grade" placeholder="例如：国内初二 / 小五 / 高一" /></label>
            <label><span>目标学校</span><input type="text" name="target" value="${escapeHtml(school.nameZh)}" /></label>
            <label><span>联系方式</span><input type="text" name="contact" placeholder="微信 SEDAGUIDE / 手机" /></label>
            <button class="primary-button" type="submit">提交咨询</button>
          </form>
        </div>
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
<script src="/seda-site.js?v=25"></script>
</body>
</html>`;
}

function renderInternationalSchoolIndex(schools, header, footer) {
  const sorted = [...schools].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  const title = '新加坡国际学校名单：IB、英国、美国、澳洲与私立国际课程学校';
  const description = `SEDA 新加坡择校网整理 ${sorted.length} 所新加坡国际学校独立页面，覆盖 IB、英国课程、美国 AP、澳洲课程、Cambridge、IGCSE、A-Level 与小规模国际学校。`;
  const indexTags = unique(sorted.flatMap((school) => seoTagsForSchool(school))).slice(0, 36);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${domain}/international-school/schools/`,
    inLanguage: 'zh-CN',
    about: indexTags.map((tag) => ({ '@type': 'Thing', name: tag })),
    knowsAbout: indexTags,
    mainEntity: sorted.map((school) => ({
      '@type': 'School',
      name: school.nameZh,
      alternateName: school.nameEn,
      url: `${domain}${schoolUrl(school)}`,
      address: school.location,
      knowsAbout: seoTagsForSchool(school).slice(0, 10),
    })),
    publisher: {
      '@type': 'Organization',
      name: 'SEDA 新加坡择校网',
      url: `${domain}/`,
    },
  };
  const cards = sorted.map((school) => `
        <a class="article-card" href="${schoolUrl(school)}">
          <span class="tag">${escapeHtml(school.curriculum)}</span>
          <h3>${escapeHtml(school.nameZh)}</h3>
          <p>${escapeHtml(school.nameEn)}</p>
          <p>${escapeHtml(school.location)} · ${escapeHtml(school.features?.slice(0, 3).join(' / ') || '国际课程')}</p>
        </a>`).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>${escapeHtml(title)} | SEDA 新加坡择校网</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="keywords" content="新加坡国际学校名单,新加坡国际学校数据库,新加坡IB学校,新加坡英国国际学校,新加坡美国学校"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="${domain}/international-school/schools/"/>
<link rel="stylesheet" href="/seda-site.css?v=36"/>
<script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body>
${header}
<nav class="breadcrumb" aria-label="面包屑导航"><a href="/">首页</a> <span class="bc-sep">›</span> <a href="/international-school/">国际学校</a> <span class="bc-sep">›</span> <span>国际学校名单</span></nav>
<main>
  <section class="page-hero school-hero">
    <p class="eyebrow">国际学校数据库</p>
    <h1>新加坡国际学校名单</h1>
    <p class="hero-subtitle">${escapeHtml(description)}</p>
  </section>
  <section class="section">
    <div class="section-head">
      <p class="eyebrow">学校 SEO 页面</p>
      <h2>${sorted.length} 所国际学校独立择校页</h2>
      <p>每所学校页面都包含课程体系、适合学生、费用关注、申请路径、FAQ 与结构化数据，方便中国家长快速比较。</p>
    </div>
    <div class="seo-tag-cloud seo-tag-cloud-wide">${indexTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="article-grid">
${cards}
    </div>
  </section>
  <section class="contact-section" id="contact" aria-labelledby="contact-title">
    <div>
      <p class="eyebrow">免费咨询</p>
      <h2 id="contact-title">不知道哪所国际学校适合孩子？</h2>
      <p>告诉我们孩子年龄、英文基础、预算和目标大学方向，SEDA 顾问会帮你缩小学校范围。</p>
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
            <ul><li>国际学校推荐</li><li>AEIS 规划</li><li>A-Level 规划</li><li>学费预算分析</li></ul>
          </div>
        </div>
      </div>
      <form class="lead-form">
        <label><span>学生当前年级</span><input type="text" name="grade" placeholder="例如：国内小五 / 初二 / 高一" /></label>
        <label><span>目标课程</span><input type="text" name="target" placeholder="IB / A-Level / AP / WACE / 还不确定" /></label>
        <label><span>联系方式</span><input type="text" name="contact" placeholder="微信 SEDAGUIDE / 手机" /></label>
        <button class="primary-button" type="submit">提交咨询</button>
      </form>
    </div>
  </section>
</main>
${footer}
<script src="/seda-site.js?v=25"></script>
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
  const internationalSchools = schools.filter((school) => school.type === 'international');
  if (internationalSchools.length) {
    const indexDir = path.join(root, 'international-school', 'schools');
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, 'index.html'), renderInternationalSchoolIndex(internationalSchools, header, footer), 'utf8');
  }
  return schools.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = buildSchoolPages();
  console.log(`Built ${count} school SEO pages.`);
}
