// 旧站 URL 状态导出：把 2022–2025 旧站可能留下、百度索引里可能还存着
// 的地址全部打一遍，导出「现在是什么状态」，供站长平台死链提交和申诉使用。
//
// 背景：2026-11-25 查到 site:sgeda.org.cn 只剩 1 条结果，指向已下线的
// test.sgeda.org.cn。索引里大概率存的都是这批旧地址，必须先证明它们
// 现在都已正确跳转/消失，百度才会替换成新页面。
//
// 用法：node scripts/legacy-url-audit.mjs
// 输出：reports/legacy-urls.csv + 终端汇总

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://sgeda.org.cn';

const urls = new Set();

// 1) 旧站编号详情页：按当年实际出现过的区间覆盖（多给一点余量）
for (let i = 1; i <= 130; i += 1) urls.add(`/school/detail/${i}`);
for (let i = 1; i <= 24; i += 1) urls.add(`/pages/detail/${i}`);
for (let i = 1; i <= 40; i += 1) urls.add(`/news/detail/${i}`);
for (let i = 1; i <= 6; i += 1) urls.add(`/project/detail/${i}`);
for (let i = 1; i <= 4; i += 1) urls.add(`/project/list/${i}`);
urls.add('/project');
urls.add('/feedback');

// 2) 旧站图片（当年挂在 /attach/image/ 下）
for (const img of [
  '1679034835_fb9614e0947406090af3.jpg',
  '1679040993_dc3a81193521a01a4664.jpg',
  '1679290118_23f1994d2e2f5f93a655.jpg',
  '1681962361_6acf2c2b6238ad711ddd.jpg',
]) urls.add(`/attach/image/${img}`);

// 3) dead-links.txt 里维护的清单
const deadList = path.join(root, 'dead-links.txt');
if (fs.existsSync(deadList)) {
  for (const line of fs.readFileSync(deadList, 'utf8').split('\n')) {
    const u = line.trim();
    if (!u.startsWith('http')) continue;
    try {
      const { hostname, pathname } = new URL(u);
      if (hostname === 'sgeda.org.cn' || hostname === 'www.sgeda.org.cn') urls.add(pathname);
    } catch { /* ignore */ }
  }
}

const results = [];
const list = [...urls].sort();

async function check(p) {
  const url = BASE + p;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const code = res.status;
    const loc = res.headers.get('location') || '';
    let ok = false;
    if (code === 301 || code === 308) ok = loc.startsWith(BASE) || loc.startsWith('/');
    else if (code === 410) ok = true;
    else if (code === 200) ok = false; // 旧地址不该还返回内容
    return { path: p, status: code, location: loc, ok };
  } catch (err) {
    return { path: p, status: 'ERR', location: String(err.message).slice(0, 40), ok: false };
  }
}

const CONCURRENCY = 8;
for (let i = 0; i < list.length; i += CONCURRENCY) {
  const batch = list.slice(i, i + CONCURRENCY).map(check);
  results.push(...(await Promise.all(batch)));
}

const csv = ['path,status,location,ok']
  .concat(results.map((r) => `${r.path},${r.status},"${r.location}",${r.ok ? 1 : 0}`))
  .join('\n');
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports', 'legacy-urls.csv'), csv + '\n', 'utf8');

const byStatus = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
const bad = results.filter((r) => !r.ok);

console.log(`检查 ${results.length} 个旧地址`);
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
if (bad.length) {
  console.log(`\n需要处理 ${bad.length} 个：`);
  for (const r of bad.slice(0, 20)) console.log(`  ${r.status} ${r.path} ${r.location}`);
}
console.log('\n报告：reports/legacy-urls.csv');
