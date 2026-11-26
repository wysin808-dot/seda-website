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

// 与原列表样式逐字一致；中学生成块标记来源，测试可独立校验共享样式。
export const STATIC_SCHOOL_LIST_STYLE = `
    .all-schools{max-width:1240px;margin:40px auto 0;padding:0 clamp(16px,4vw,40px)}
    .all-schools details{border:1px solid #e7e1d6;border-radius:12px;background:#fbf8f2;padding:14px 18px}
    .all-schools summary{cursor:pointer;font-weight:700;color:#1f2328}
    .all-schools ul{list-style:none;margin:14px 0 0;padding:0;columns:3;column-gap:28px;font-size:14px;line-height:1.9}
    .all-schools li{break-inside:avoid}
    .all-schools a{color:#0b5cad;text-decoration:none;border-bottom:1px solid rgba(11,92,173,.25)}
    @media(max-width:900px){.all-schools ul{columns:2}}
    @media(max-width:600px){.all-schools ul{columns:1}}
  `;

export function addStaticSchoolList(root, { checkOnly = false, targetDirs = null } = {}) {
  // 显式列出的学校库用固定标题；其余栏目自动扫描（只补未链接的子页）
  const explicit = {
    'primary-schools': '全部政府小学',
    'secondary-schools': '全部政府中学',
    'private-schools': '全部私立学校',
  };
  const targets = [];
  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = dirent.name;
    // 定向运行时既不读写其他 hub，也不枚举其详情页面。
    if (targetDirs && !targetDirs.includes(dir)) continue;
    if (dir.startsWith('.') || ['node_modules', 'content', 'assets', 'cms', 'content-review', 'reports', 'scripts', 'docs', 'data'].includes(dir)) continue;
    const hub = path.join(root, dir, 'index.html');
    if (!fs.existsSync(hub)) continue;
    const children = fs.readdirSync(path.join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, dir, e.name, 'index.html')));
    if (children.length < 2) continue;
    targets.push({ dir, urlPrefix: `/${dir}/`, label: explicit[dir] || '更多内容' });
  }

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

    // 默认只补缺少内链的详情页。中学另保留既有补充索引中仍存在的目标：
    // 卡片修正不应删除独立的可展开查校通道；新增缺链合并，过期目标剔除。
    const before = fs.readFileSync(hub, 'utf8');
    const blockRe = new RegExp(`${START}[\\s\\S]*?${END}`, 'g');
    const previousBlock = (before.match(blockRe) || []).join('\n');
    const cleanHub = before.replace(blockRe, '');
    const retained = new Set(t.dir === 'secondary-schools'
      ? (previousBlock.match(/href=["']([^"']+)["']/g) || [])
        .map(m => m.replace(/^href=["']/, '').replace(/["']$/, ''))
      : []);
    // 单双引号都要认（二级页的卡片用的是 href='...'），并且按 URL 去重
    const linked = new Set(
      (cleanHub.match(new RegExp(`href=["'](${t.urlPrefix}[^"']+)["']`, 'g')) || [])
        .map((m) => m.replace(/^href=["']/, '').replace(/["']$/, '')),
    );
    const listed = entries.filter((e) => !linked.has(e.link) || retained.has(e.link));
    if (!listed.length) {
      let cur = before;
      if (cur.includes(START)) {
        const removalRe = t.dir === 'secondary-schools'
          ? new RegExp(`^[\\t ]*${START}[\\s\\S]*?${END}[\\t ]*\\n?`, 'm')
          : new RegExp(`${START}[\\s\\S]*?${END}\\n?`);
        cur = cur.replace(removalRe, '');
        if (!checkOnly) fs.writeFileSync(hub, cur, 'utf8');
        if (t.dir === 'secondary-schools' && cur !== before) updated += 1;
      }
      continue;
    }

    const items = listed.map((s2) => `      <li><a href="${s2.link}">${s2.name}</a></li>`).join('\n');

    const isSchoolLib = Boolean(explicit[t.dir]);
    const unit = isSchoolLib ? '所' : '个页面';
    const label = t.dir === 'secondary-schools'
      ? `补充学校索引（${listed.length} 所，共 ${entries.length} 所，按拼音排序，可展开）`
      : listed.length === entries.length
        ? `${t.label}（${listed.length} ${unit}，按拼音排序，可展开）`
        : `其余 ${listed.length} ${unit}（共 ${entries.length} ${unit}，按拼音排序，可展开）`;
    const block = `${START}
<section class="all-schools" aria-labelledby="all-schools-title">
  <style${t.dir === 'secondary-schools' ? ' data-seda-generator="add-static-school-list"' : ''}>${STATIC_SCHOOL_LIST_STYLE}</style>
  <details>
    <summary id="all-schools-title">${label}</summary>
    <ul>
${items}
    </ul>
  </details>
</section>
${END}`;

    let html = before;
    if (html.includes(START)) {
      html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
    } else if (html.includes('</main>')) {
      html = html.replace('</main>', `${block}\n</main>`);
    } else if (html.includes('<footer class="site-footer"')) {
      // o-level / jc 这类枢纽没有 <main>，插在页脚之前
      html = html.replace('<footer class="site-footer"', `${block}\n<footer class="site-footer"`);
    } else {
      continue;
    }
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
