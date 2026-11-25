#!/usr/bin/env node
// content-lint.mjs —— 页面「AI 味」量化尺子
//
// 背景：SEDA 有 600+ 个静态页，正被判为「低质 AI 批量内容」。这个脚本只读页面，
// 不改任何 HTML，用来（1）找出当前最差的页，（2）接入 CI，防止新文章退回 AI 腔。
//
// 用法：
//   node scripts/content-lint.mjs                 全站汇总 + 写 reports/content-lint.csv
//   node scripts/content-lint.mjs --check         只查 git 变更页，不达标 exit 1
//   node scripts/content-lint.mjs <url或路径>      只查单页，打印全部指标与命中套话
//
// 指标为什么能反映「AI 味」（也写在每个指标旁）：
//   1. clichesPerK      套话密度。AI 写作喜欢用「需要注意的是 / 总的来说 / 此外 /
//                       因此 / 有助于 / 全方位」这类连接与总结词，人写的内容更少。
//                       千字归一化，避免长文天然占便宜。
//   2. factsPerK        具体信息密度。年份、学费 S$、百分比、月数、万、ATAR、L1R5、
//                       ELR2B2 这些硬信息必须来自真实数据；AI 泛泛而谈时几乎为零。
//   3. namedParagraphRatio 换名测试。把校名换成任何一所学校都读得通的段落 = 模板文；
//                       真正针对某校写的段落会反复点名，因此「提到校名的段落占比」
//                       越高越像人写的（仅学校类页面适用）。
//   4. wordCount        正文字数。太短的页面信息量不足，也常是批量生成的占位页。
//   5. dupSentences     页内重复句。同一句 >20 字的话在正文出现两次以上，通常是
//                       模板拼装 / 采集复制的痕迹。
//   6. score            0-100「人味分」，算法见下方 scorePage()。
//
// 说明：
//   - 依赖只有 cheerio（package.json 已有），不引入新包。
//   - 正文 = <body> 删掉 script/style/nav/header/footer 后的纯文本（按需求顺序先整段删，
//     再 .text() 剥标签），避免导航/页脚把字数与套话密度带偏。
//   - 千字为 0 或正文 <800 字不崩：密度记 0，空页 score 直接 0，<800 字在输出标注 short。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://sgeda.org.cn';

// 套话词表（按需求原样）。用于 clichesPerK 与单页命中明细。
const CLICHES = [
  '需要注意的是', '值得注意', '总的来说', '总体而言', '综上所述', '换言之',
  '也就是说', '换句话说', '此外', '同时', '因此', '从而', '有助于', '旨在',
  '致力于', '不仅', '而且', '全方位', '多维度', '更好地', '有效', '关键',
  '核心', '实际上', '事实上', '可以说', '一定程度上', '相对而言', '首先',
  '其次', '最后', '另外', '通常', '往往', '很多家长', '对中国学生来说', '本文',
];

// 具体信息（硬数据）模式。命中越多，说明内容越可能基于真实资料而非空泛生成。
const FACT_PATTERNS = [
  /\d{4}\s*年/g,          // 年份：2025年 / 2025 年
  /S\$/g,                 // 新加坡元金额
  /\d+(?:\.\d+)?%/g,      // 百分比
  /\d+\s*个月/g,           // 月数
  /\d+\s*万/g,             // 人民币/人数等「万」
  /ATAR\s*\d+/gi,         // 澳洲 ATAR
  /L1R[45]/g,             // JC 录取分
  /ELR2B2/g,              // Poly 录取分
];

// 只有这些栏目下的页面才做换名测试（学校/院校详情页）。
const SCHOOL_PREFIXES = [
  '/secondary-schools/', '/primary-schools/', '/jc/',
  '/international-school/', '/poly/', '/private-schools/',
];

const STOP_NAMES = /^(?:SEDA|MOE|SEAB|ICA|COP|IP|JC|IB|AP|SAT|PSLE|O-?Level|A-?Level|IGCSE|AEIS|S-?AEIS|SEC|CCA|DSA|GEP|NUS|NTU|SMU|Primary|Secondary|Junior|Senior|Main|Poly|Singapore|Campus|Convent)$/i;
// 括号里偶尔是专题名而不是校名（如「Direct Admissions Exercise」「Chinese Students Admission Guide」），
// 用这些通用词和「带斜杠/数字开头」的形态排掉，避免换名测试拿错名字。
const NON_NAME = /\b(?:Guide|Admission|Admissions|Exercise|Course|Courses|Checklist|Timeline|Fees|Ranking|Comparison|Students?)\b/i;

const round = (n, d = 2) => Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0;
const stripHash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// URL -> 本地 index.html。sitemap 里的 URL 以 / 结尾，对应 目录/index.html。
function urlToFile(url) {
  const pathname = new URL(url, ORIGIN).pathname;
  const rel = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  return path.join(root, decodeURIComponent(rel));
}

function fileToUrl(file) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const pathname = '/' + rel.replace(/index\.html$/, '');
  return ORIGIN + pathname;
}

function isSchoolPath(url) {
  const p = new URL(url, ORIGIN).pathname;
  return SCHOOL_PREFIXES.some((prefix) => p.startsWith(prefix));
}

// 从 <title>/<h1>（以及结构化 meta description / eyebrow 兜底）提取英文校名。
// 需求主来源是 title/h1：括号内连续英文，或 School/College 前的英文串。
// 现实里大量学校页 title/h1 只有中文（如「海军部中学怎么样？…」），英文名只出现在
// <meta name="description"> 的「（Admiralty Secondary School）」里。为让换名测试
// 真正覆盖学校页，仅在 title/h1 取不到时，退回到 meta description / 首屏 eyebrow。
function extractEnglishName({ h1, title, description, eyebrow }) {
  const candidates = [];
  const collect = (raw) => {
    const s = stripHash(raw);
    if (!s) return;
    // 中文全角括号优先：校名里常再套一层英文括号，如（Anglo-Chinese School (Primary)）。
    for (const m of s.matchAll(/（([^）]+)）/g)) candidates.push(m[1]);
    // 英文括号允许再套一层，避免只抓到 (Primary)、(Singapore) 这种片段。
    for (const m of s.matchAll(/\(((?:[^()]|\([^()]*\))*)\)/g)) candidates.push(m[1]);
    for (const m of s.matchAll(/([A-Z][A-Za-z0-9&.'’\- ]{2,}?)\s+(?:School|College|Academy|Institute|Polytechnic)\b/g)) {
      candidates.push(m[0]);
    }
    // 标题以英文校名开头、后面直接跟中文词的写法，如「5 Steps Academy怎么样？」
    const lead = s.match(/^([A-Z][A-Za-z0-9&.'’\- ]{2,}?)(?=\s*(?:怎么样|完整指南|国际学校|$))/);
    if (lead) candidates.push(lead[1]);
  };

  // title/h1 为主，按需求优先；取不到才用结构化兜底字段。
  [h1, title, description, eyebrow].forEach(collect);

  for (const raw of candidates) {
    const name = stripHash(raw)
      .replace(/^[·•\-–—\s]+|[·•\-–—\s]+$/g, '')
      .replace(/\s+(?:建于|成立于).*$/, '')
      .trim();
    if (name.length < 3) continue;
    if (!/[A-Za-z]/.test(name)) continue;
    if (/[\/|]/.test(name)) continue;        // 如 SP/NP/NYP/TP/RP、IB/AP/A-Level
    if (/^\d/.test(name)) continue;          // 如 2026 JAE
    if (STOP_NAMES.test(name)) continue;
    if (NON_NAME.test(name)) continue;
    return name;
  }
  return null;
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/[。！？!?；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

// 核心分析。返回原始数值（未舍入），便于打分与汇总。
function analyseHtml(html, url) {
  const $ = load(html);
  const title = $('title').first().text();
  const h1 = $('h1').first().text();
  const description = $('meta[name="description"]').attr('content') || '';
  const eyebrow = $('.eyebrow').first().text();

  // 先整段删除非正文容器，再取纯文本，避免导航/页脚污染字数与套话计数。
  $('script, style, nav, header, footer').remove();
  const bodyText = $('body').text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  // 正文字数（去空白后的字符数；中文场景下 1 字≈1 词，千字口径统一用它）。
  const wordCount = bodyText.replace(/\s/g, '').length;

  // 套话密度（每千字命中次数）。
  const clicheCounts = {};
  let clicheHits = 0;
  for (const word of CLICHES) {
    const n = bodyText.split(word).length - 1;
    if (n > 0) clicheCounts[word] = n;
    clicheHits += n;
  }
  const clichesPerK = wordCount > 0 ? (clicheHits / wordCount) * 1000 : 0;

  // 具体信息密度（每千字硬数据命中次数）。
  let factHits = 0;
  for (const re of FACT_PATTERNS) {
    factHits += (bodyText.match(re) || []).length;
  }
  const factsPerK = wordCount > 0 ? (factHits / wordCount) * 1000 : 0;

  // 换名测试：只对学校栏目做；正文段落 >60 字才计入。
  const paragraphs = $('p').toArray()
    .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 60);
  let schoolName = null;
  let namedParagraphRatio = null;
  if (isSchoolPath(url)) {
    schoolName = extractEnglishName({ h1, title, description, eyebrow });
    if (schoolName) {
      const needle = schoolName.toLowerCase();
      const named = paragraphs.filter((t) => t.toLowerCase().includes(needle)).length;
      namedParagraphRatio = paragraphs.length ? named / paragraphs.length : 0;
    }
  }

  // 页内重复句：>20 字的句子出现 ≥2 次，记 1 个重复句（按不同句子数量计）。
  const counts = new Map();
  for (const s of splitSentences(bodyText)) {
    const key = s.replace(/\s+/g, '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const dupSentences = [...counts.values()].filter((n) => n >= 2).length;

  return {
    url,
    title: stripHash(title),
    h1: stripHash(h1),
    wordCount,
    short: wordCount < 800,
    clicheHits,
    clichesPerK,
    factHits,
    factsPerK,
    schoolName,
    namedParagraphRatio,
    namedParagraphs: namedParagraphRatio == null
      ? null
      : paragraphs.filter((t) => t.toLowerCase().includes(schoolName.toLowerCase())).length,
    paragraphCount: paragraphs.length,
    dupSentences,
    clicheCounts,
    score: scorePage({ clichesPerK, factsPerK, namedParagraphRatio, wordCount }),
    bodyText,
  };
}

// 综合「人味分」0-100：
//   具体信息 factsPerK：每 1 次/千字给 8 分，封顶 40 分（即 ≥5 次/千字拿满）。
//   套话 clichesPerK：0 次/千字 +30；每 1 次/千字扣 10，最低 0。
//   换名测试：提名比例 0-1 线性给 0-30 分。
//   - 非学校页 / 取不到校名：换名项不适用，把前两项按 70 分满分折算成 100，避免误伤。
//   - 学校页取到校名但比例 0：保留 /100 口径（换名项就是 0 分），反映模板化。
//   最终 clamp 到 0-100。
//   - 正文 0 字直接记 0：否则「没有套话」会让空页反而拿到 42.9 分。
function scorePage({ clichesPerK, factsPerK, namedParagraphRatio, wordCount }) {
  if (!wordCount) return 0;
  const factsScore = Math.min(40, factsPerK * 8);
  const clichesScore = Math.max(0, 30 - clichesPerK * 10);
  const base = factsScore + clichesScore;
  const score = namedParagraphRatio == null
    ? (base / 70) * 100
    : base + 30 * Math.max(0, Math.min(1, namedParagraphRatio));
  return Math.max(0, Math.min(100, score));
}

function readSitemapUrls() {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function analyseUrl(url) {
  const file = urlToFile(url);
  if (!fs.existsSync(file)) return { url, file, missing: true };
  const html = fs.readFileSync(file, 'utf8');
  return analyseHtml(html, url);
}

function fmt(n, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) : '-';
}

function mean(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function printSummary(rows, missing) {
  const withSwap = rows.filter((r) => r.namedParagraphRatio != null);
  const short = rows.filter((r) => r.short);
  console.log('SEDA 内容体检 · AI 味（人味分）全站汇总');
  console.log('='.repeat(76));
  console.log(`页面数：${rows.length}${missing.length ? `（另有 ${missing.length} 页缺失）` : ''}；正文 <800 字：${short.length} 页`);
  console.log(`人味分 score            均值 ${fmt(mean(rows.map((r) => r.score)), 1)}  / 100（越低越像 AI 批量文）`);
  console.log(`正文字数 wordCount      均值 ${fmt(mean(rows.map((r) => r.wordCount)), 0)} 字`);
  console.log(`套话密度 clichesPerK    均值 ${fmt(mean(rows.map((r) => r.clichesPerK)))} 次/千字`);
  console.log(`信息密度 factsPerK      均值 ${fmt(mean(rows.map((r) => r.factsPerK)))} 次/千字`);
  console.log(`换名提名 namedParagraphRatio 均值 ${fmt(mean(withSwap.map((r) => r.namedParagraphRatio)), 3)}`
    + `（${withSwap.length} 页可测 / ${rows.filter((r) => isSchoolPath(r.url)).length} 页属学校栏目）`);
  console.log(`重复句 dupSentences     均值 ${fmt(mean(rows.map((r) => r.dupSentences)))} 句/页`);

  const worst = [...rows].sort((a, b) => a.score - b.score || b.clichesPerK - a.clichesPerK).slice(0, 15);
  console.log('\n最差的 15 页（score 升序；swap=换名提名比例，short=正文 <800 字）：');
  console.log('score  words  clich/K  fact/K  swap    dup   url');
  console.log('-'.repeat(76));
  for (const r of worst) {
    const swap = r.namedParagraphRatio == null ? '  -  ' : fmt(r.namedParagraphRatio, 2).padStart(5);
    console.log(
      `${fmt(r.score, 1).padStart(5)}  ${String(r.wordCount).padStart(5)}  ${fmt(r.clichesPerK, 2).padStart(6)}  `
      + `${fmt(r.factsPerK, 2).padStart(6)}  ${swap}  ${String(r.dupSentences).padStart(4)}  `
      + `${r.url.replace(ORIGIN, '')}${r.short ? '  [short]' : ''}`,
    );
  }
}

function writeCsv(rows) {
  const dir = path.join(root, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const header = 'score,wordCount,clichesPerK,factsPerK,namedParagraphRatio,dupSentences,url';
  const lines = rows
    .slice()
    .sort((a, b) => a.score - b.score)
    .map((r) => [
      round(r.score, 1),
      r.wordCount,
      round(r.clichesPerK, 2),
      round(r.factsPerK, 2),
      r.namedParagraphRatio == null ? '' : round(r.namedParagraphRatio, 3),
      r.dupSentences,
      r.url,
    ].join(','));
  const file = path.join(dir, 'content-lint.csv');
  fs.writeFileSync(file, [header, ...lines].join('\n') + '\n', 'utf8');
  console.log(`\nCSV 已写入：${path.relative(root, file)}（${rows.length} 行）`);
}

function clicheLine(r) {
  const entries = Object.entries(r.clicheCounts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '  套话命中：无';
  return '  套话命中（' + r.clicheHits + ' 次）：'
    + entries.map(([w, n]) => `${w}×${n}`).join('、');
}

function printPage(r) {
  console.log(`URL：${r.url}`);
  console.log(`标题：${r.title}`);
  console.log('='.repeat(60));
  console.log(`score（人味分，0-100）      ${fmt(r.score, 1)}${r.score < 40 ? '  ← 低于 40 门槛' : ''}`);
  console.log(`wordCount（正文字数）        ${r.wordCount}${r.short ? '  ← 正文 <800 字' : ''}`);
  console.log(`clichesPerK（套话/千字）     ${fmt(r.clichesPerK)}`);
  console.log(`factsPerK（硬信息/千字）     ${fmt(r.factsPerK)}（命中 ${r.factHits} 次）`);
  if (r.namedParagraphRatio == null) {
    console.log(`namedParagraphRatio（换名）  null（非学校栏目或取不到英文校名）`);
  } else {
    console.log(`namedParagraphRatio（换名）  ${fmt(r.namedParagraphRatio, 3)}`
      + `（${r.namedParagraphs}/${r.paragraphCount} 段提到「${r.schoolName}」）`);
  }
  console.log(`dupSentences（页内重复句）   ${r.dupSentences}`);
  console.log(clicheLine(r));
}

// --check：只看 git 变更过的 index.html。任何一页 score<40，或「通常」/「对中国学生来说」
// 在正文出现 ≥3 次，就 exit 1，并逐条打印原因，供 CI 防回归。
function runCheck() {
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (error) {
    console.error('无法执行 git diff --name-only HEAD：' + error.message);
    process.exit(1);
  }

  const pages = changed
    .filter((rel) => rel.endsWith('index.html'))
    .filter((rel) => fs.existsSync(path.join(root, rel)));

  if (!pages.length) {
    console.log(`检查完毕：变更的 index.html 共 0 页，未发现回归。`);
    return;
  }

  const results = [];
  const failures = [];
  for (const rel of pages) {
    const file = path.join(root, rel);
    const url = fileToUrl(file);
    const r = analyseHtml(fs.readFileSync(file, 'utf8'), url);
    const reasons = [];
    if (r.score < 40) reasons.push(`score ${fmt(r.score, 1)} < 40`);
    for (const phrase of ['通常', '对中国学生来说']) {
      const n = r.clicheCounts[phrase] || 0;
      if (n >= 3) reasons.push(`「${phrase}」出现 ${n} 次（≥3）`);
    }
    results.push({ rel, r, reasons });
    if (reasons.length) failures.push({ rel, r, reasons });
  }

  console.log(`检查变更页 ${results.length} 页：通过 ${results.length - failures.length} / 失败 ${failures.length}`);
  for (const { rel, r, reasons } of failures) {
    console.log(`FAIL  ${fmt(r.score, 1).padStart(5)}  ${rel}  (套话 ${fmt(r.clichesPerK)}/千字, 硬信息 ${fmt(r.factsPerK)}/千字)`);
    console.log('      原因：' + reasons.join('；'));
  }

  if (failures.length) {
    console.error(`\ncontent:lint:check 失败：${failures.length} 页不达标，阻断提交。`);
    process.exit(1);
  }
  console.log('\ncontent:lint:check 通过。');
}

// 单页：支持 https://sgeda.org.cn/xxx/、/xxx/、xxx/index.html、目录路径。
function resolveSingle(input) {
  if (/^https?:\/\//i.test(input)) return urlToFile(input);
  const cleaned = input.split(/[?#]/)[0];
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(root, cleaned.replace(/^\/+/, '')),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) return path.join(candidate, 'index.html');
    return candidate;
  }
  return candidates[0];
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    runCheck();
    return;
  }

  if (args[0]) {
    const file = resolveSingle(args[0]);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      console.error(`找不到页面：${args[0]}（解析为 ${file}）`);
      process.exit(1);
    }
    printPage(analyseHtml(fs.readFileSync(file, 'utf8'), fileToUrl(file)));
    return;
  }

  const urls = readSitemapUrls();
  const rows = [];
  const missing = [];
  for (const url of urls) {
    const r = analyseUrl(url);
    if (r.missing) missing.push(r);
    else rows.push(r);
  }

  printSummary(rows, missing);
  writeCsv(rows);
  if (missing.length) {
    console.log('\n缺失页面（sitemap 有 URL，本地无 index.html）：');
    for (const m of missing) console.log('  ' + m.url);
  }
}

// 直接执行时跑 CLI；被 import 时只暴露函数，便于以后写测试或在别的脚本里复用。
const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();

export {
  CLICHES,
  FACT_PATTERNS,
  SCHOOL_PREFIXES,
  analyseHtml,
  analyseUrl,
  extractEnglishName,
  scorePage,
};
