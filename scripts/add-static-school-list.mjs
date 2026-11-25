// 给小学库加一份静态可抓取的学校链接列表。
//
// 问题：/primary-schools/ 的 179 所学校全部由 JS 渲染（psGrid），HTML 里
// 一条学校链接都没有——179 个页面零入链，蜘蛛只能靠 sitemap 知道它们存在。
// secondary-schools 早就做过同类修复（prerender-secondary-schools.mjs），
// primary 一直没补。
//
// 做法：解析页面里的 schools 数组，在列表下方生成一个可展开的完整链接列表。
// 对用户是「按字母查全部学校」，对爬虫是 179 个真实内链。
// 幂等：以 <!-- SEDA_ALL_SCHOOLS_START --> 为界替换。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '<!-- SEDA_ALL_SCHOOLS_START -->';
const END = '<!-- SEDA_ALL_SCHOOLS_END -->';

export function addStaticSchoolList(root, { checkOnly = false } = {}) {
  const targets = [
    { dir: 'primary-schools', urlPrefix: '/primary-schools/', label: '全部政府小学' },
    { dir: 'secondary-schools', urlPrefix: '/secondary-schools/', label: '全部政府中学' },
    { dir: 'private-schools', urlPrefix: '/private-schools/', label: '全部私立学校' },
  ];

  let updated = 0;
  for (const t of targets) {
    const hub = path.join(root, t.dir, 'index.html');
    if (!fs.existsSync(hub)) continue;

    // 从目录里枚举学校页（不依赖页面里的 JS 数组——它可能只覆盖了一部分）
    const entries = fs.readdirSync(path.join(root, t.dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, t.dir, e.name, 'index.html')))
      .map((e) => {
        const page = fs.readFileSync(path.join(root, t.dir, e.name, 'index.html'), 'utf8');
        const h1 = (page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || e.name;
        const name = h1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
          .replace(/\s*(完全指南|完全攻略|中文指南|指南)$/, '');
        return { name, link: `${t.urlPrefix}${e.name}/` };
      })
      .filter((x) => x.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

    if (entries.length < 5) continue;

    // 只补「枢纽页还没链接到」的学校：secondary 已有预渲染卡片，
    // 全量再列一遍只会产生重复链接。统计时排除脚本自己生成过的块。
    const cleanHub = fs.readFileSync(hub, 'utf8').replace(new RegExp(`${START}[\\s\\S]*?${END}`, 'g'), '');
    const linked = new Set(cleanHub.match(new RegExp(`href="${t.urlPrefix}[^"/]+/`, 'g')) || []);
    const missing = entries.filter((e) => !linked.has(`href="${e.link}"`));
    if (!missing.length) {
      let cur = fs.readFileSync(hub, 'utf8');
      if (cur.includes(START)) {
        cur = cur.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`), '');
        if (!checkOnly) fs.writeFileSync(hub, cur, 'utf8');
      }
      continue;
    }

    const items = missing.map((s2) => `      <li><a href="${s2.link}">${s2.name}</a></li>`).join('\n');

    const allLinked = entries.length - missing.length;
    const label = allLinked === 0
      ? `${t.label}（${missing.length} 所，按拼音排序，可展开）`
      : `其余 ${missing.length} 所（共 ${entries.length} 所，按拼音排序，可展开）`;
    const block = `${START}
<section class="all-schools" aria-labelledby="all-schools-title">
  <style>
    .all-schools{max-width:1240px;margin:40px auto 0;padding:0 clamp(16px,4vw,40px)}
    .all-schools details{border:1px solid #e7e1d6;border-radius:12px;background:#fbf8f2;padding:14px 18px}
    .all-schools summary{cursor:pointer;font-weight:700;color:#1f2328}
    .all-schools ul{list-style:none;margin:14px 0 0;padding:0;columns:3;column-gap:28px;font-size:14px;line-height:1.9}
    .all-schools li{break-inside:avoid}
    .all-schools a{color:#0b5cad;text-decoration:none;border-bottom:1px solid rgba(11,92,173,.25)}
    @media(max-width:900px){.all-schools ul{columns:2}}
    @media(max-width:600px){.all-schools ul{columns:1}}
  </style>
  <details>
    <summary id="all-schools-title">${label}</summary>
    <ul>
${items}
    </ul>
  </details>
</section>
${END}`;

    let html = fs.readFileSync(hub, 'utf8');
    if (html.includes(START)) {
      html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
    } else if (html.includes('</main>')) {
      html = html.replace('</main>', `${block}\n</main>`);
    } else {
      continue;
    }
    const before = fs.readFileSync(hub, 'utf8');
    if (html !== before) {
      if (!checkOnly) fs.writeFileSync(hub, html, 'utf8');
      updated += 1;
    }
  }
  return { updated };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { updated } = addStaticSchoolList(root, { checkOnly: process.argv.includes('--check') });
  console.log(`静态学校列表：更新 ${updated} 个枢纽页`);
}
