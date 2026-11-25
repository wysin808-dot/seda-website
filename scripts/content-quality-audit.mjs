// 内容质量体检：给每个 sitemap 页面打分，输出 reports/content-quality-audit.csv
//
// 目的：百度对"低质批量内容"是站点级判定，必须先把页面分成「值得留」和
// 「必须藏」。这个脚本只读，不修改任何页面，用来给人工裁剪提供依据。
//
// 用法：node scripts/content-quality-audit.mjs
//
// 评分（0-100），刻意只用可核验的硬信号：
//   字数          <1200/1200-2500/2500-4000/>4000  → 0/10/20/25
//   官方来源外链  0/1-2/3+                          → 0/5/10   (gov/edu/官方机构)
//   作者署名      有                                  → 10
//   案例与引述    有"案例/家长说/招生官/学生反馈"+数字 → 10
//   数据表格      <table> ≥1                          → 10
//   FAQ 结构化    FAQPage schema                      → 5
//   更新时间      30 天内                              → 5
//   模板化惩罚    与同族页面 H2 完全一致               → -15
//   极短惩罚      正文 <800 字                         → -20
//
// 分档：A ≥40 主打页（值得重写成人写内容）；B 30-39 保留观察；C <30 建议下架/屏蔽
// 注意：全站目前没有作者署名和真实案例，任何页面都拿不到那 20 分，50 分就是现实上限。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const today = new Date();

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

function localFile(url) {
  const p = new URL(url).pathname;
  if (p === '/' || p.endsWith('/')) return path.join(root, p, 'index.html');
  return path.join(root, p, 'index.html');
}

function analyse(file, url) {
  const html = fs.readFileSync(file, 'utf8');
  const $ = load(html);
  const h2s = $('h2').map((_, el) => $(el).text().replace(/\s+/g, '').trim()).get();
  $('script, style, nav, header, footer').remove();
  const words = $('body').text().replace(/\s+/g, '').length;

  const official = new Set();
  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const host = new URL(href).hostname.replace(/^www\./, '');
      if (/\.gov(\.|$)|\.edu(\.|$)|\.edu\.|moe\.gov|seab\.gov|ica\.gov|scsa\.|tisc\.|acra\.gov/.test(host)) official.add(host);
    } catch { /* ignore */ }
  });

  const author = Boolean(
    $('meta[name="author"]').attr('content') ||
    $('[rel="author"]').length ||
    $('.article-author, .byline, [data-author]').length
  );
  const bodyText = $('body').text();
  const cases = /(真实案例|案例[:：]|家长反馈|学生反馈|招生官|亲历|我们跟进|访谈)/.test(bodyText) && /\d/.test(bodyText);
  const tables = $('table').length;
  const faq = $('script[type="application/ld+json"]').toArray()
    .some((el) => { try { return /"FAQPage"/.test($(el).text()); } catch { return false; } });
  const lastmod = ($('meta[name="last-modified"]').attr('content') || '');
  const fresh = lastmod ? (today - new Date(lastmod)) / 86400000 <= 30 : false;

  return { url, file: path.relative(root, file), words, h2s, official: [...official], author, cases, tables, faq, fresh };
}

const rows = urls.map((url) => {
  const file = localFile(url);
  if (!fs.existsSync(file)) return { url, missing: true };
  try { return analyse(file, url); } catch (e) { return { url, error: e.message }; }
}).filter((r) => !r.missing && !r.error);

// 模板化：同一路径前缀下 H2 结构完全一致
const sig = (r) => r.h2s.join('|');
const byPrefix = new Map();
for (const r of rows) {
  const prefix = r.url.replace('https://sgeda.org.cn', '').split('/').filter(Boolean)[0] || 'root';
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Map());
  const m = byPrefix.get(prefix);
  m.set(sig(r), (m.get(sig(r)) || 0) + 1);
}
const templated = (r) => {
  const prefix = r.url.replace('https://sgeda.org.cn', '').split('/').filter(Boolean)[0] || 'root';
  return (byPrefix.get(prefix)?.get(sig(r)) || 0) >= 5;
};

for (const r of rows) {
  let score = 0;
  score += r.words < 1200 ? 0 : r.words < 2500 ? 10 : r.words < 4000 ? 20 : 25;
  score += r.official.length === 0 ? 0 : r.official.length <= 2 ? 5 : 10;
  if (r.author) score += 10;
  if (r.cases) score += 10;
  if (r.tables > 0) score += 10;
  if (r.faq) score += 5;
  if (r.fresh) score += 5;
  if (templated(r)) score -= 15;
  if (r.words < 800) score -= 20;
  r.score = Math.max(0, Math.min(100, score));
  // 门槛按「没有作者/案例时可达上限约 50 分」校准，否则全站都是 C 没有区分度
  r.grade = r.score >= 40 ? 'A' : r.score >= 30 ? 'B' : 'C';
  r.templated = templated(r);
}

rows.sort((a, b) => b.score - a.score);
const dir = path.join(root, 'reports');
fs.mkdirSync(dir, { recursive: true });
const csv = ['grade,score,words,official_links,tables,faq,author,cases,templated,url']
  .concat(rows.map((r) => [r.grade, r.score, r.words, r.official.length, r.tables, r.faq ? 1 : 0, r.author ? 1 : 0, r.cases ? 1 : 0, r.templated ? 1 : 0, r.url].join(',')))
  .join('\n');
fs.writeFileSync(path.join(dir, 'content-quality-audit.csv'), csv + '\n', 'utf8');

const count = (g) => rows.filter((r) => r.grade === g).length;
console.log(`体检 ${rows.length} 页：A ${count('A')} / B ${count('B')} / C ${count('C')}`);
console.log('模板化页面：' + rows.filter((r) => r.templated).length);
console.log('有作者署名的页面：' + rows.filter((r) => r.author).length);
console.log('引用官方来源的页面：' + rows.filter((r) => r.official.length > 0).length);
console.log('\nTop 10（最该保住并重写）:');
for (const r of rows.slice(0, 10)) console.log(`  ${r.grade} ${String(r.score).padStart(3)} ${String(r.words).padStart(5)}字 ${r.url}`);
console.log('\nBottom 10（最该下架/屏蔽）:');
for (const r of rows.slice(-10)) console.log(`  ${r.grade} ${String(r.score).padStart(3)} ${String(r.words).padStart(5)}字 ${r.url}`);
console.log('\n报告：reports/content-quality-audit.csv');
