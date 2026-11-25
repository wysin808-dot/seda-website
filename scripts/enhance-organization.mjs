// 全站注入唯一的 Organization 实体节点（带稳定 @id）。
//
// 为什么：站点 644 个页面里，99.8% 有电话/邮箱/备案，但只有 5.9% 写了
// 实体地址、13.4% 写了法定名称、12.7% 能外链第三方（百科）。百度/Google
// 需要一条「这家机构真的存在」的稳定证据链，而不是散落在页脚的文字。
//
// 做法：读 content/organization.json，把同一个节点写进每个 sitemap 页面，
// 用 @id 固定身份，其他页面的 publisher 可以引用它。
//
// 幂等：以 <!-- SEDA_ORG_START --> / END 为界替换。
// 用法：node scripts/enhance-organization.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '<!-- SEDA_ORG_START -->';
const END = '<!-- SEDA_ORG_END -->';

export function applyOrganization(root, { checkOnly = false } = {}) {
  const orgPath = path.join(root, 'content', 'organization.json');
  if (!fs.existsSync(orgPath)) throw new Error('缺少 content/organization.json');
  const org = JSON.parse(fs.readFileSync(orgPath, 'utf8'));

  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const block = `${START}\n<script type="application/ld+json">${JSON.stringify(org)}</script>\n${END}`;

  let updated = 0;
  const missing = [];
  for (const url of urls) {
    const { pathname } = new URL(url);
    const file = path.join(root, pathname, 'index.html');
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let html = before;
    if (html.includes(START)) {
      html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${block}\n</head>`);
    } else {
      missing.push(url);
      continue;
    }
    if (checkOnly) {
      if (!before.includes(START)) missing.push(url);
      continue;
    }
    if (html !== before) { fs.writeFileSync(file, html, 'utf8'); updated += 1; }
  }
  return { updated, total: urls.length, missing };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const { updated, total, missing } = applyOrganization(root, { checkOnly });
  if (missing.length) console.log(`未注入 ${missing.length} 页（无 </head> 或检查模式）：` + missing.slice(0, 5).join(', '));
  console.log(checkOnly ? `✅ Organization 节点检查完成（${total} 页）` : `Organization 节点：更新 ${updated} 页，共 ${total} 页`);
  if (checkOnly && missing.length) process.exit(1);
}
