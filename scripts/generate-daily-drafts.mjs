import fs from 'node:fs';
import path from 'node:path';
import { researchBrief } from './editorial-policy.mjs';
import { frontmatterOptimizationFields, suggestedDescription, suggestedSeoTitle } from './seo-optimizer.mjs';

const root = process.cwd();
const articleDir = path.join(root, 'content', 'articles');
const queueFile = path.join(root, 'content', 'keyword-queue.csv');
const logFile = path.join(root, 'data', 'content-production-log.jsonl');

const categoryLabels = {
  wace: 'WACE 课程',
  'o-level': 'O-Level 升学',
  aeis: 'AEIS 考试',
  'international-school': '国际学校',
  pathway: '升学路径',
  guides: '留学指南',
  university: '公立大学',
};

const relatedLinks = {
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
    ['AEIS 年龄要求', '/aeis/age-requirements/'],
    ['AEIS 数学备考', '/aeis/math/'],
  ],
  'international-school': [
    ['国际学校指南', '/international-school/'],
    ['学校数据库', '/school-database/'],
    ['留学费用指南', '/guides/cost/'],
  ],
  pathway: [
    ['升学路径总览', '/pathway/'],
    ['中国学生升学路径', '/pathway/chinese-students-singapore-pathway/'],
    ['AI 升学规划', '/tools/study-planner.html'],
  ],
  guides: [
    ['留学指南', '/guides/'],
    ['学生准证申请', '/guides/student-pass/'],
    ['留学费用指南', '/guides/cost/'],
  ],
  university: [
    ['公立大学总览', '/university/'],
    ['NUS 申请指南', '/university/nus/'],
    ['NTU 申请指南', '/university/ntu/'],
  ],
};

const seedKeywords = [
  ['WACE ATAR怎么算', 'wace', 'high', 'pending', '自动补充'],
  ['WACE Methods适合中国学生吗', 'wace', 'high', 'pending', '自动补充'],
  ['WACE Specialist难吗', 'wace', 'high', 'pending', '自动补充'],
  ['WACE EALD是什么', 'wace', 'medium', 'pending', '自动补充'],
  ['WACE申请香港大学可以吗', 'wace', 'medium', 'pending', '自动补充'],
  ['O-Level申请JC需要多少分', 'o-level', 'high', 'pending', '自动补充'],
  ['O-Level申请Poly怎么选专业', 'o-level', 'high', 'pending', '自动补充'],
  ['O-Level国际学生怎么报名', 'o-level', 'high', 'pending', '自动补充'],
  ['O-Level学校推荐怎么看', 'o-level', 'medium', 'pending', '自动补充'],
  ['新加坡AEIS英文怎么准备', 'aeis', 'high', 'pending', '自动补充'],
  ['AEIS插班新加坡政府学校难吗', 'aeis', 'medium', 'pending', '自动补充'],
  ['新加坡国际学校怎么选', 'international-school', 'high', 'pending', '自动补充'],
  ['中国学生升学新加坡路径怎么选', 'pathway', 'high', 'pending', '自动补充'],
  ['新加坡学生准证被拒怎么办', 'guides', 'medium', 'pending', '自动补充'],
  ['中国学生申请NUS本科难吗', 'university', 'high', 'pending', '自动补充'],
  ['WACE课程一年学费多少钱', 'wace', 'high', 'pending', '自动补充'],
  ['WACE选课怎么选比较稳', 'wace', 'high', 'pending', '自动补充'],
  ['WACE数学Methods和Specialist区别', 'wace', 'high', 'pending', '自动补充'],
  ['WACE申请澳洲八大需要多少ATAR', 'wace', 'high', 'pending', '自动补充'],
  ['WACE和IB哪个适合中国学生', 'wace', 'medium', 'pending', '自动补充'],
  ['WACE Year 11可以插班吗', 'wace', 'medium', 'pending', '自动补充'],
  ['O-Level英文难度对中国学生高吗', 'o-level', 'high', 'pending', '自动补充'],
  ['O-Level重考值得吗', 'o-level', 'medium', 'pending', '自动补充'],
  ['O-Level科目怎么搭配', 'o-level', 'high', 'pending', '自动补充'],
  ['O-Level成绩不好还能读Poly吗', 'o-level', 'medium', 'pending', '自动补充'],
  ['O-Level国际学生可以自学报名吗', 'o-level', 'medium', 'pending', '自动补充'],
  ['AEIS数学难度相当于国内几年级', 'aeis', 'high', 'pending', '自动补充'],
  ['AEIS英文写作怎么提高', 'aeis', 'high', 'pending', '自动补充'],
  ['AEIS没有考上怎么办', 'aeis', 'high', 'pending', '自动补充'],
  ['S-AEIS和AEIS有什么区别', 'aeis', 'medium', 'pending', '自动补充'],
  ['新加坡政府小学怎么申请', 'aeis', 'medium', 'pending', '自动补充'],
  ['新加坡国际学校一年多少钱', 'international-school', 'high', 'pending', '自动补充'],
  ['新加坡国际学校IB怎么选', 'international-school', 'medium', 'pending', '自动补充'],
  ['新加坡国际学校入学考试考什么', 'international-school', 'medium', 'pending', '自动补充'],
  ['国际学校转政府学校可行吗', 'international-school', 'medium', 'pending', '自动补充'],
  ['中国初中生去新加坡读书怎么选路径', 'pathway', 'high', 'pending', '自动补充'],
  ['国内高一转新加坡还来得及吗', 'pathway', 'high', 'pending', '自动补充'],
  ['新加坡留学陪读妈妈可以工作吗', 'guides', 'high', 'pending', '自动补充'],
  ['新加坡留学一年总费用怎么估算', 'guides', 'high', 'pending', '自动补充'],
  ['新加坡学生住宿怎么选', 'guides', 'medium', 'pending', '自动补充'],
  ['NUS和NTU申请哪个更难', 'university', 'high', 'pending', '自动补充'],
  ['中国学生申请NTU本科需要什么成绩', 'university', 'high', 'pending', '自动补充'],
  ['新加坡公立大学接受WACE成绩吗', 'university', 'high', 'pending', '自动补充'],
  ['新加坡大学本科申请时间线', 'university', 'medium', 'pending', '自动补充'],
];

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(input) {
  const compact = String(input)
    .toLowerCase()
    .replace(/适合中国学生吗/g, '-chinese-students')
    .replace(/申请香港大学可以吗/g, '-apply-hku')
    .replace(/申请jc需要多少分/g, '-jc-score')
    .replace(/申请poly怎么选专业/g, '-poly-course-choice')
    .replace(/国际学生怎么报名/g, '-international-students-registration')
    .replace(/学校推荐怎么看/g, '-school-recommendation')
    .replace(/课程一年学费多少钱/g, '-tuition-fees')
    .replace(/选课怎么选比较稳/g, '-subject-selection')
    .replace(/数学methods和specialist区别/g, '-methods-vs-specialist')
    .replace(/申请澳洲八大需要多少atar/g, '-apply-australia-go8-atar')
    .replace(/和ib哪个适合中国学生/g, '-vs-ib-chinese-students')
    .replace(/year 11可以插班吗/g, '-year-11-transfer')
    .replace(/英文难度对中国学生高吗/g, '-english-difficulty-chinese-students')
    .replace(/重考值得吗/g, '-retake-worth-it')
    .replace(/科目怎么搭配/g, '-subject-combination')
    .replace(/成绩不好还能读poly吗/g, '-low-score-poly')
    .replace(/国际学生可以自学报名吗/g, '-private-candidate-registration')
    .replace(/数学难度相当于国内几年级/g, '-math-difficulty-china-grade')
    .replace(/英文写作怎么提高/g, '-english-writing')
    .replace(/没有考上怎么办/g, '-failed-what-to-do')
    .replace(/和aeis有什么区别/g, '-vs-aeis')
    .replace(/政府小学怎么申请/g, '-government-primary-application')
    .replace(/一年多少钱/g, '-annual-fees')
    .replace(/ib怎么选/g, '-ib-how-to-choose')
    .replace(/入学考试考什么/g, '-entrance-test')
    .replace(/转政府学校可行吗/g, '-transfer-to-government-school')
    .replace(/初中生去新加坡读书怎么选路径/g, '-secondary-student-pathway')
    .replace(/高一转新加坡还来得及吗/g, '-grade-10-transfer')
    .replace(/陪读妈妈可以工作吗/g, '-guardian-work')
    .replace(/一年总费用怎么估算/g, '-total-cost')
    .replace(/学生住宿怎么选/g, '-accommodation')
    .replace(/和ntu申请哪个更难/g, '-vs-ntu-difficulty')
    .replace(/申请ntu本科需要什么成绩/g, '-ntu-undergraduate-requirements')
    .replace(/公立大学接受wace成绩吗/g, '-public-university-wace')
    .replace(/大学本科申请时间线/g, '-undergraduate-application-timeline')
    .replace(/怎么算/g, '-calculation')
    .replace(/是什么/g, '-what-is')
    .replace(/难吗/g, '-difficulty')
    .replace(/怎么准备/g, '-preparation')
    .replace(/怎么选/g, '-how-to-choose')
    .replace(/怎么办/g, '-what-to-do')
    .replace(/wace/g, 'wace')
    .replace(/o-level|o level|o水准/gi, 'o-level')
    .replace(/aeis/gi, 'aeis')
    .replace(/a-level|a level/gi, 'a-level')
    .replace(/nus/gi, 'nus')
    .replace(/ntu/gi, 'ntu')
    .replace(/poly/gi, 'poly')
    .replace(/jc/gi, 'jc')
    .replace(/atar/gi, 'atar')
    .replace(/methods/gi, 'methods')
    .replace(/specialist/gi, 'specialist')
    .replace(/eald/gi, 'eald')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return compact || `seo-${Date.now()}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value);
  return cells;
}

function readQueue() {
  if (!fs.existsSync(queueFile)) {
    fs.mkdirSync(path.dirname(queueFile), { recursive: true });
    fs.writeFileSync(queueFile, 'keyword,category,priority,status,notes\n', 'utf8');
  }
  const [headerLine, ...lines] = fs.readFileSync(queueFile, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const rows = lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((key, index) => [key, cells[index] || '']));
  });
  return { headers, rows };
}

function writeQueue(headers, rows) {
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key] || '')).join(',')),
  ].join('\n');
  fs.writeFileSync(queueFile, `${body}\n`, 'utf8');
}

function ensureQueueBacklog(headers, rows) {
  const existing = new Set(rows.map((row) => row.keyword));
  let added = 0;
  for (const [keyword, category, priority, status, notes] of seedKeywords) {
    if (existing.has(keyword)) continue;
    rows.push({ keyword, category, priority, status, notes });
    added += 1;
  }
  if (added) writeQueue(headers, rows);
}

function uniqueSlug(category, keyword) {
  const base = slugify(keyword);
  let slug = base;
  let n = 2;
  while (fs.existsSync(path.join(articleDir, `${category}-${slug}.md`))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function frontmatterValue(value) {
  return String(value).replaceAll('\n', ' ').replaceAll(':', '：');
}

function frontmatterBoolean(value) {
  return value ? 'true' : 'false';
}

function linksFor(category) {
  return relatedLinks[category] || relatedLinks.guides;
}


function createDraft(row) {
  const keyword = row.keyword.trim();
  const category = (row.category || 'guides').trim();
  const label = categoryLabels[category] || category;
  const slug = uniqueSlug(category, keyword);
  const file = path.join(articleDir, `${category}-${slug}.md`);
  const title = suggestedSeoTitle(keyword, category);
  const description = suggestedDescription(keyword, label);
  const article = researchBrief(keyword);
  const optimization = frontmatterOptimizationFields({
    draft: true,
    contentType: 'research-brief',
    title,
    primaryKeyword: keyword,
    description,
    category,
    categoryLabel: label,
    slug,
  }, article);
  const body = `---
title: ${frontmatterValue(title)}
primaryKeyword: ${frontmatterValue(keyword)}
description: ${frontmatterValue(description)}
keywords: ${frontmatterValue(`${keyword},${label},新加坡留学,中国学生升学`)}
category: ${frontmatterValue(category)}
categoryLabel: ${frontmatterValue(label)}
slug: ${frontmatterValue(slug)}
date: ${today()}
tags: ${frontmatterValue(`${label},新加坡留学,中国家长`)}
draft: true
contentType: research-brief
reviewStatus: pending
generatedBy: daily-draft-system
seoScore: ${optimization.seoScore}
seoLevel: ${frontmatterValue(optimization.seoLevel)}
seoRecommendedPublish: ${frontmatterBoolean(optimization.seoRecommendedPublish)}
seoSuggestedTitle: ${frontmatterValue(optimization.seoSuggestedTitle)}
seoSuggestedDescription: ${frontmatterValue(optimization.seoSuggestedDescription)}
imageRequired: ${frontmatterBoolean(optimization.imageRequired)}
imageHero: ${frontmatterValue(optimization.imageHero)}
imageAlt: ${frontmatterValue(optimization.imageAlt)}
imagePrompt: ${frontmatterValue(optimization.imagePrompt)}
infographicSuggestion: ${frontmatterValue(optimization.infographicSuggestion)}
---

${article}
`;
  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return { keyword, category, slug, file };
}

const count = Math.max(1, Math.min(Number(option('count', '1')) || 1, 3));
const dryRun = process.argv.includes('--dry-run');
const { headers, rows } = readQueue();
if (!dryRun) ensureQueueBacklog(headers, rows);

const existingKeywords = new Set(fs.existsSync(articleDir) ? fs.readdirSync(articleDir).filter(file => file.endsWith('.md')).flatMap(file => {
  const raw = fs.readFileSync(path.join(articleDir, file), 'utf8');
  return [...raw.matchAll(/^(?:primaryKeyword|title):\s*(.+)$/gm)].map(match => match[1].replace(/^["']|["']$/g, '').trim());
}) : []);

const candidates = rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => !['done', 'draft', 'published', 'skip'].includes(String(row.status || '').toLowerCase()))
  .filter(({ row }) => !existingKeywords.has(row.keyword.trim()))
  .sort((a, b) => {
    const weight = { high: 0, medium: 1, low: 2 };
    return (weight[a.row.priority] ?? 3) - (weight[b.row.priority] ?? 3);
  })
  .slice(0, count);

if (!candidates.length) {
  console.log('No pending keywords. Queue is already clear.');
  process.exit(0);
}

const created = [];
for (const item of candidates) {
  if (dryRun) {
    created.push({ keyword: item.row.keyword, category: item.row.category, slug: slugify(item.row.keyword) });
    continue;
  }
  const draft = createDraft(item.row);
  rows[item.index].status = 'draft';
  rows[item.index].notes = `已生成草稿 /${draft.category}/${draft.slug}/`;
  created.push(draft);
}

if (!dryRun) {
  writeQueue(headers, rows);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), count: created.length, drafts: created.map(({ keyword, category, slug }) => ({ keyword, category, slug })) })}\n`, 'utf8');
}

console.log(JSON.stringify({ ok: true, dryRun, created: created.map(({ keyword, category, slug }) => ({ keyword, category, slug })) }, null, 2));
