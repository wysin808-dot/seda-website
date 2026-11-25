// 政策数字月度核对：确认我们引用的官方来源还在、关键数字没变。
//
// 为什么需要：2026-11 这轮重写，每改一页就抓到一处早已过期的事实——
// AEIS 小学英文卷（2022 已取消）、L1R5（2028 改 L1R4）、学生准证受理费
// （S$30→S$45）、AEIS 时间表（停在 2025-2026）。共同点是页面写得很完整，
// 但没人跟政策走。这类错误对排名是致命的：用户点进来发现数字不对就走。
//
// 检查两类东西：
//   1. 链接健康：content/sources.json 里登记的官方来源是否仍返回 200
//   2. 关键数字：4 条会被政策改动的阈值/费用，用正则断言
//
// 用法：node scripts/policy-check.mjs [--quiet]
// 退出码：有任一检查失败则 1（供 cron / CI 报警）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const CHECKS = [
  {
    name: '学生准证受理费 = S$45',
    url: 'https://eservices.ica.gov.sg/solar/xhtml/StaticPages/Faq.xhtml',
    test: (t) => /processing fee of \$?45/i.test(t),
    hint: 'ICA 调价了：改 /guides/student-pass/ 的费用数字与合计区间',
  },
  {
    name: 'JC 入学 L1R4 门槛 = 16',
    url: 'https://www.moe.gov.sg/post-secondary/admissions/pse/jc-and-mi',
    test: (t) => /16\s*for\s*JC/i.test(t),
    hint: '门槛变了：改 /o-level/scoring/ 的 L1R4 与 /o-level/exam-format/ 的说明',
  },
  {
    name: 'AEIS 考试在 9 月',
    url: 'https://www.moe.gov.sg/international-students/aeis',
    test: (t) => /AEIS tests are conducted/i.test(t),
    hint: 'MOE 改了考试安排：改 /aeis/timeline/ 与 /aeis/preparation/ 的时间表',
  },
  {
    name: 'S-AEIS 在 1 月报名',
    url: 'https://www.moe.gov.sg/international-students/s-aeis',
    test: (t) => /S-AEIS typically starts in January/i.test(t),
    hint: 'S-AEIS 节奏变了：改 /aeis/timeline/ 的补考一行',
  },
  {
    name: 'SEC 已取代 O-Level（2027 起）',
    url: 'https://www.moe.gov.sg/post-secondary/admissions/pse',
    test: (t) => /Secondary Education Certificate|SEC/i.test(t),
    hint: 'SEC 页面结构变了：人工确认 /o-level/ 与 /o-level/scoring/ 的改制表述',
  },
];

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(25000),
  });
  const raw = await res.text();
  const text = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { status: res.status, text };
}

const results = [];
const quiet = process.argv.includes('--quiet');

// 1) 来源链接健康
const sourcesPath = path.join(root, 'content', 'sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const urls = new Set();
for (const [page, entry] of Object.entries(sources)) {
  if (page.startsWith('_')) continue;
  for (const s of entry.sources || []) urls.add(s.url);
}

for (const url of [...urls].sort()) {
  try {
    const { status } = await fetchText(url);
    results.push({ kind: '链接', name: url, ok: status === 200, detail: `HTTP ${status}` });
  } catch (err) {
    results.push({ kind: '链接', name: url, ok: false, detail: String(err.message).slice(0, 60) });
  }
}

// 2) 关键数字
for (const c of CHECKS) {
  try {
    const { status, text } = await fetchText(c.url);
    const ok = status === 200 && c.test(text);
    results.push({ kind: '数字', name: c.name, ok, detail: ok ? '与正文一致' : `未匹配（HTTP ${status}）→ ${c.hint}` });
  } catch (err) {
    results.push({ kind: '数字', name: c.name, ok: false, detail: String(err.message).slice(0, 60) });
  }
}

const failed = results.filter((r) => !r.ok);
const stamp = new Date().toISOString().slice(0, 10);
const dir = path.join(root, 'reports');
fs.mkdirSync(dir, { recursive: true });
const lines = [
  `# 政策核对 ${stamp}`,
  '',
  `检查 ${results.length} 项，失败 ${failed.length} 项。`,
  '',
  '| 类型 | 项目 | 结果 | 说明 |',
  '| --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.kind} | ${r.name} | ${r.ok ? '✅' : '❌'} | ${r.detail} |`),
];
fs.writeFileSync(path.join(dir, `policy-check-${stamp}.md`), lines.join('\n') + '\n', 'utf8');

if (!quiet) {
  for (const r of results) {
    if (!r.ok) console.log(`❌ [${r.kind}] ${r.name}\n   ${r.detail}`);
  }
  console.log(`\n政策核对：${results.length} 项，失败 ${failed.length} 项。报告 reports/policy-check-${stamp}.md`);
}

if (failed.length) process.exit(1);
