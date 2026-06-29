const categoryImageThemes = {
  wace: {
    filenamePrefix: 'wace',
    hero: '新加坡国际高中教室、学生查看课程表和 ATAR 升学路径图，真实教育媒体风格',
    altSuffix: 'WACE 课程与中国学生升学规划',
  },
  'o-level': {
    filenamePrefix: 'o-level',
    hero: '新加坡中学生备考 O-Level、书桌上的考试计划和 JC/Poly 路径图，真实教育资讯风格',
    altSuffix: 'O-Level 考试与新加坡升学路径',
  },
  aeis: {
    filenamePrefix: 'aeis',
    hero: '低龄学生准备 AEIS 英文和数学、家长查看新加坡政府学校申请时间线，真实教育咨询风格',
    altSuffix: 'AEIS 考试与政府学校插班规划',
  },
  'international-school': {
    filenamePrefix: 'international-school',
    hero: '新加坡国际学校校园、课程体系对比和选校 checklist，真实国际教育媒体风格',
    altSuffix: '新加坡国际学校选校指南',
  },
  pathway: {
    filenamePrefix: 'pathway',
    hero: '中国学生新加坡升学路径流程图，AEIS、O-Level、WACE、JC、Poly 与大学出口清晰呈现',
    altSuffix: '中国学生新加坡升学路径规划',
  },
  guides: {
    filenamePrefix: 'guide',
    hero: '新加坡留学材料清单、学生准证申请流程和家长规划笔记，真实留学指南风格',
    altSuffix: '新加坡留学申请与家长指南',
  },
  university: {
    filenamePrefix: 'university',
    hero: '新加坡公立大学申请资料、专业选择表和校园建筑，真实大学申请媒体风格',
    altSuffix: '新加坡大学申请规划',
  },
};

const coreLinksByCategory = {
  wace: ['/wace/', '/wace-atar/', '/wace-vs-a-level/', '/wace-nus-ntu/'],
  'o-level': ['/o-level/', '/o-level-jc/', '/o-level-poly/', '/secondary-schools/'],
  aeis: ['/aeis/', '/aeis/age-requirements/', '/aeis/math/', '/primary-schools/'],
  'international-school': ['/international-school/', '/international-school/schools/', '/guides/cost/', '/pathway/'],
  pathway: ['/pathway/', '/aeis/', '/o-level/', '/wace/'],
  guides: ['/guides/', '/guides/student-pass/', '/guides/cost/', '/contact/'],
  university: ['/university/', '/university/nus/', '/university/ntu/', '/pathway/'],
};

export function stripMarkdown(markdown = '') {
  return String(markdown || '')
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentLength(markdown = '') {
  return stripMarkdown(markdown).replace(/\s/g, '').length;
}

export function markdownInternalLinks(markdown = '') {
  return [...String(markdown || '').matchAll(/\[[^\]]+]\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

export function markdownImages(markdown = '') {
  return [...String(markdown || '').matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)]
    .map((match) => ({ alt: match[1].trim(), src: match[2].trim() }))
    .filter((item) => item.src);
}

export function hasFaqSection(markdown = '') {
  const text = String(markdown || '');
  return /(^|\n)#{2,4}\s*(FAQ|常见问题|家长常问|常见问答)/i.test(text) || /[？?]\s*(\n|$)/.test(text);
}

export function faqQuestionCount(markdown = '') {
  const text = String(markdown || '');
  const faqMatch = text.match(/(^|\n)##\s*(FAQ|常见问题|家长常问|常见问答)[\s\S]*$/i);
  const source = faqMatch ? faqMatch[0] : text;
  return (source.match(/^###\s+.+[？?]?\s*$/gm) || []).length;
}

function cleanKeyword(keyword = '') {
  return String(keyword || '').replace(/\s+/g, ' ').trim();
}

function safeSlugPart(value = '') {
  const text = String(value || '')
    .toLowerCase()
    .replace(/wace/g, 'wace')
    .replace(/o-level|o level|o水准/gi, 'o-level')
    .replace(/aeis/gi, 'aeis')
    .replace(/a-level|a level/gi, 'a-level')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return text || 'seo-guide';
}

export function suggestedSeoTitle(keyword = '', category = 'guides') {
  const key = cleanKeyword(keyword);
  if (!key) return '新加坡升学规划指南：适合中国学生和家长的路径分析';
  if (/是什么|怎么选|难吗|怎么办|怎么算|可以吗|怎么看|怎么准备/.test(key)) {
    const suffix = category === 'wace' ? '中国学生读 WACE 怎么判断'
      : category === 'o-level' ? '中国学生 O-Level 升学怎么规划'
        : category === 'aeis' ? '中国学生申请政府学校怎么准备'
          : category === 'university' ? '中国学生申请新加坡大学怎么规划'
            : '中国学生和家长怎么判断';
    return `${key}？${suffix}`;
  }
  return `${key}完整指南：适合中国学生的新加坡升学规划`;
}

export function suggestedDescription(keyword = '', categoryLabel = '新加坡升学') {
  const key = cleanKeyword(keyword);
  return `${key}中文指南，面向中国家长拆解${categoryLabel}的适合人群、准备时间、申请路径、常见误区和下一步规划建议。`;
}

export function imagePlanForArticle(meta = {}) {
  const category = meta.category || 'guides';
  const theme = categoryImageThemes[category] || categoryImageThemes.guides;
  const keyword = cleanKeyword(meta.primaryKeyword || meta.title || meta.slug || '新加坡升学');
  const slug = safeSlugPart(`${theme.filenamePrefix}-${meta.slug || keyword}`);
  return {
    required: true,
    count: 2,
    heroFilename: `${slug}-cover.webp`,
    heroAlt: `${keyword}：${theme.altSuffix}`,
    heroPrompt: theme.hero,
    infographicFilename: `${slug}-flow.webp`,
    infographicAlt: `${keyword}路径图、时间线或选校 checklist`,
    infographicPrompt: `为“${keyword}”制作一张中文信息图，包含关键判断步骤、时间线、常见路径和家长注意事项，教育门户风格，红白配色，适合文章中部阅读。`,
  };
}

function levelFromIssues(issues) {
  if (issues.some((item) => item.severity === 'error')) return 'error';
  if (issues.some((item) => item.severity === 'warning')) return 'warning';
  return 'pass';
}

function pushIssue(issues, severity, message) {
  issues.push({ severity, message });
}

export function optimizeArticle({ meta = {}, body = '', html = '', inSitemap = false, htmlExists = false } = {}) {
  const issues = [];
  const suggestions = [];
  const images = markdownImages(body);
  const length = contentLength(body);
  const h2Count = (String(body).match(/^##\s+/gm) || []).length;
  const faqCount = faqQuestionCount(body);
  const hasFaq = hasFaqSection(body);
  const internalLinks = markdownInternalLinks(body);
  const imagePlan = imagePlanForArticle(meta);
  const title = cleanKeyword(meta.title);
  const keyword = cleanKeyword(meta.primaryKeyword || title);
  const description = cleanKeyword(meta.description);
  const category = meta.category || 'guides';
  const recommendedLinks = coreLinksByCategory[category] || coreLinksByCategory.guides;
  const missingCoreLinks = recommendedLinks.filter((href) => !internalLinks.some((link) => link === href || link.startsWith(href)));

  if (!title) pushIssue(issues, 'error', '缺少标题');
  else if (!keyword || !title.includes(keyword.replace(/[？?].*$/, ''))) pushIssue(issues, 'warning', '标题与主关键词关联不够直接');
  if (title.length < 18) pushIssue(issues, 'warning', '标题偏短，建议包含搜索词 + 中国学生/家长判断场景');
  if (title.length > 48) pushIssue(issues, 'warning', '标题偏长，搜索结果可能被截断');

  if (!description) pushIssue(issues, 'error', '缺少 meta description');
  else if (description.length < 55) pushIssue(issues, 'warning', 'description 偏短，建议 55-110 字');
  else if (description.length > 125) pushIssue(issues, 'warning', 'description 偏长，建议控制在 125 字内');

  if (length < 1500) pushIssue(issues, 'warning', `正文偏短（约 ${length} 字），建议 1500 字以上`);
  if (h2Count < 5) pushIssue(issues, 'warning', 'H2 小标题偏少，建议至少 5 个结构段落');
  if (!hasFaq) pushIssue(issues, 'warning', '缺少 FAQ/常见问题段落');
  if (faqCount < 5) pushIssue(issues, 'warning', `FAQ 问题偏少（${faqCount} 个），建议 5-8 个`);
  if (internalLinks.length < 3) pushIssue(issues, 'warning', '站内内链偏少，建议至少 3-5 个');
  if (missingCoreLinks.length >= 2) pushIssue(issues, 'warning', `建议补充核心内链：${missingCoreLinks.slice(0, 3).join('、')}`);
  if (!images.length) pushIssue(issues, 'warning', '缺少正文图片，建议至少 1 张首图或信息图');
  if (images.some((item) => !item.alt || item.alt.length < 8)) pushIssue(issues, 'warning', '图片 alt 不够具体，建议包含中文关键词');

  if (!meta.draft && !htmlExists) pushIssue(issues, 'error', '已发布但生成页面不存在');
  if (!meta.draft && !inSitemap) pushIssue(issues, 'error', '已发布但未进入 sitemap');
  if (!meta.draft && html && !/"@type"\s*:\s*"Article"/.test(html)) pushIssue(issues, 'error', '已发布页面缺少 Article schema');

  if (!images.length) suggestions.push(`补首图：${imagePlan.heroFilename}，alt="${imagePlan.heroAlt}"`);
  suggestions.push(`信息图建议：${imagePlan.infographicAlt}`);
  if (missingCoreLinks.length) suggestions.push(`优先补内链：${missingCoreLinks.slice(0, 4).join('、')}`);
  if (faqCount < 5) suggestions.push('发布前把 FAQ 扩展到 5-8 个问题，方便读者快速找到重点。');

  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'error' ? 24 : 7), 0);
  const score = Math.max(0, 100 - penalty);
  const level = levelFromIssues(issues);

  return {
    score,
    level,
    recommendedPublish: level !== 'error' && score >= 78,
    suggestedTitle: suggestedSeoTitle(keyword || title, category),
    suggestedDescription: suggestedDescription(keyword || title, meta.categoryLabel || meta.category || '新加坡升学'),
    metrics: {
      length,
      h2Count,
      faqCount,
      internalLinkCount: internalLinks.length,
      imageCount: images.length,
    },
    images,
    imagePlan,
    missingCoreLinks,
    issues,
    suggestions,
  };
}

export function frontmatterOptimizationFields(meta = {}, body = '') {
  const optimization = optimizeArticle({ meta, body });
  return {
    seoScore: optimization.score,
    seoLevel: optimization.level,
    seoRecommendedPublish: optimization.recommendedPublish,
    seoSuggestedTitle: optimization.suggestedTitle,
    seoSuggestedDescription: optimization.suggestedDescription,
    imageRequired: optimization.imagePlan.required,
    imageHero: optimization.imagePlan.heroFilename,
    imageAlt: optimization.imagePlan.heroAlt,
    imagePrompt: optimization.imagePlan.heroPrompt,
    infographicSuggestion: optimization.imagePlan.infographicAlt,
  };
}
