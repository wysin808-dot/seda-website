import fs from 'node:fs';
import path from 'node:path';

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

function linksFor(category) {
  return relatedLinks[category] || relatedLinks.guides;
}

function articleBody(keyword, category) {
  const label = categoryLabels[category] || category;
  const links = linksFor(category);
  const [linkA, linkB, linkC] = links;
  return `很多家长第一次搜索“${keyword}”，通常不是为了看一个官方定义。

他们真正想确认的是：这条路对自己的孩子有没有机会、会不会浪费时间、需要提前准备什么，以及现在开始还来不来得及。

## 先说结论

如果只用一句话概括，围绕“${keyword}”做判断，不能只看一个考试或一个学校名称，而是要放进孩子的年龄、英文基础、目标学校、家庭预算和时间表里一起判断。

对中国学生来说，新加坡教育路径的优势在于选择多、分流清楚、国际认可度高；难点在于英文环境、申请节奏和信息差。家长真正要避免的，不是选错一个“名词”，而是在没有搞清楚路径逻辑之前，过早投入时间和费用。

所以这篇文章会用家长能听懂的方式，把“${keyword}”背后的路径逻辑讲清楚。你可以先把它当作一个判断框架，再结合孩子当前成绩和目标学校继续细化。

## 家长最应该先判断什么

第一，看孩子现在处在哪个年级。如果孩子还在小学或初中阶段，很多路径可以提前规划；如果已经接近考试节点，重点就不是“哪条路最好”，而是哪条路还有足够准备时间。

第二，看英文基础。新加坡升学几乎绕不开英文，不管是 ${label}、政府学校、国际学校，还是之后申请大学，英文都不是附加项，而是主线能力。

第三，看目标是本地升学还是国际升学。如果目标是新加坡政府体系，可以重点关注 [${linkA[0]}](${linkA[1]})；如果目标是大学出口，则要同时比较 [${linkB[0]}](${linkB[1]}) 和 [${linkC[0]}](${linkC[1]})。

第四，看家庭是否能接受过渡期。很多孩子不是不能适应新加坡，而是需要半年到一年的语言和学习方法调整期。家长如果把过渡期理解成“落后”，焦虑会非常大；如果提前预留，反而更容易稳住节奏。

## 什么情况比较适合

- 孩子愿意进入英文学习环境，并且家庭能接受前期适应成本。
- 家长不是只追一个学校名字，而是愿意按路径做长期规划。
- 目标比较清楚，例如政府学校、国际高中、Poly、JC 或大学申请。
- 家庭希望孩子未来保留新加坡、澳洲、英国、香港等多方向选择。

如果孩子目前英文较弱，也不代表完全不能走。但家长要把目标拆成阶段：先解决语言和学习习惯，再谈考试分数和学校层级。

## 什么情况要谨慎

如果家庭只想快速拿一个“保录取”结果，或者希望孩子完全不用适应英文环境，那就要谨慎。新加坡教育的价值在于体系和出口，不是短期包装。

另外，如果孩子已经处在非常关键的国内考试节点，转轨前一定要做时间测算。比如从国内初中转到新加坡体系，可能涉及 AEIS、O-Level、国际学校或私立学校等不同选择，每条路的准备周期都不一样。

## 家长常见误区

很多家长会先问“哪个学校最好”。但更实际的问题应该是：孩子现在适合进入哪一层级的学校？进入以后有没有能力跟上？未来出口是否匹配家庭目标？

还有家长会把课程名称当成结果。例如看到 WACE、O-Level、A-Level、IB，就直接判断哪个更高级。实际上课程只是路径的一部分，真正影响结果的是课程难度、英文要求、评估方式、大学认可和孩子适配度。

第三个误区是只看成功案例。成功案例有参考价值，但不能代替诊断。每个孩子的年级、成绩、性格和家庭预算都不同，照搬路径很容易出问题。

## 建议的规划步骤

1. 先整理孩子最近两年的成绩单、英文水平和目标国家。
2. 再判断是走政府学校、国际学校、私立学校，还是国际高中课程。
3. 把关键考试时间倒推出来，确认还有几个月准备。
4. 对比至少两条备选路径，不要只押一个方向。
5. 如果目标是大学申请，要提前看课程出口和大学认可度。

对家长来说，最重要的是把问题从单点选择，变成“这个方向放在孩子整个升学路径里是否合理”。

## 和其他路径怎么比较

比较路径时，不要只比较名气，而要比较五个维度：英文要求、考试压力、课程评估方式、大学出口、孩子适应成本。

例如，有些学生适合考试型路径，有些学生更适合过程评估；有些家庭希望孩子冲新加坡本地大学，有些家庭希望保留澳洲、英国、香港方向。目标不同，路径自然不同。

如果还没有明确目标，可以先从 [升学路径总览](/pathway/) 看整体结构，再回到具体课程或学校选择。

## 家长下一步可以怎么做

建议先不要急着定学校。更好的顺序是：先确定孩子年龄和当前水平，再确定目标出口，最后选择课程和学校。

如果你已经有孩子的年级、成绩、英文水平和目标大学方向，可以把这四项列出来，再对照 SEDA 的 [学校数据库](/school-database/) 和 [留学指南](/guides/) 做第一轮筛选。

## 常见问题

### 英文一般的学生适合考虑这个方向吗？

要看“一般”到什么程度。如果孩子能接受英文课堂，只是词汇和写作需要加强，通常可以通过过渡期补上；如果完全排斥英文环境，就要先做语言适应，不建议直接冲高强度课程。

### 什么时候开始准备比较合适？

多数家庭至少要预留 6-12 个月。如果涉及政府学校考试、国际高中课程或大学申请，越早规划越稳。临近节点才开始准备，也不是完全没机会，但选择会明显变少。

### 家长最容易忽略什么？

最容易忽略的是路径之间的衔接。一个学校或课程本身看起来不错，但如果后面无法顺利接到目标大学或目标国家，就未必适合孩子。

### 是否需要先咨询再决定？

如果家庭只是初步了解，可以先阅读相关页面和文章；如果已经涉及转学、考试报名或大学申请，建议尽早做一次路径评估，避免方向选错后再补救。
`;
}

function createDraft(row) {
  const keyword = row.keyword.trim();
  const category = (row.category || 'guides').trim();
  const label = categoryLabels[category] || category;
  const slug = uniqueSlug(category, keyword);
  const file = path.join(articleDir, `${category}-${slug}.md`);
  const description = `${keyword}完整指南：面向中国家长的新加坡升学规划文章，拆解适合人群、申请节奏、常见误区和下一步建议。`;
  const body = `---
title: ${frontmatterValue(keyword)}
description: ${frontmatterValue(description)}
keywords: ${frontmatterValue(`${keyword},${label},新加坡留学,中国学生升学`)}
category: ${frontmatterValue(category)}
categoryLabel: ${frontmatterValue(label)}
slug: ${frontmatterValue(slug)}
date: ${today()}
tags: ${frontmatterValue(`${label},新加坡留学,中国家长`)}
draft: true
reviewStatus: pending
generatedBy: daily-draft-system
---

${articleBody(keyword, category)}
`;
  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return { keyword, category, slug, file };
}

const count = Math.max(1, Math.min(Number(option('count', '5')) || 5, 10));
const dryRun = process.argv.includes('--dry-run');
const { headers, rows } = readQueue();
ensureQueueBacklog(headers, rows);

const candidates = rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => !['done', 'draft', 'published', 'skip'].includes(String(row.status || '').toLowerCase()))
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
