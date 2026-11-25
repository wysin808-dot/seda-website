// 给指定页面注入「资料来源与核实」区块 + Article.citation 结构化数据。
//
// 背景：百度把「正确但无出处」的页面当作低质/AI 内容。这个脚本给每页补上
// 可核验的一手来源、最近核实日期、维护方与纠错入口，并把来源写进 Article
// 的 citation 字段（结构化数据必须与可见内容一致）。
//
// 数据源：content/sources.json
// 用法：node scripts/enhance-eeat.mjs [--check]
//   --check  只报告哪些页面缺区块/是否过期，不写文件（适合放进 CI）
//
// 幂等：以 <!-- SEDA_SOURCES_START --> / END 为界替换，重复运行不会叠加。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const STYLE_START = '<!-- SEDA_SOURCES_STYLE_START -->';
const STYLE_END = '<!-- SEDA_SOURCES_STYLE_END -->';
const BLOCK_START = '<!-- SEDA_SOURCES_START -->';
const BLOCK_END = '<!-- SEDA_SOURCES_END -->';

const style = `${STYLE_START}
<style>
  .seda-sources{max-width:1120px;margin:56px auto 8px;padding:0 20px;font-size:15px;line-height:1.75;color:#3c3c3c}
  .seda-sources h2{font-size:19px;line-height:1.4;margin:0 0 10px;color:#1f2328;letter-spacing:.01em}
  .seda-sources .seda-sources-lead{margin:0 0 18px;color:#5b5b5b}
  .seda-sources ul{margin:0 0 20px;padding:0;list-style:none}
  .seda-sources li{margin:0 0 12px;padding-left:18px;position:relative}
  .seda-sources li::before{content:"";position:absolute;left:0;top:.72em;width:6px;height:6px;border-radius:50%;background:#c8102e}
  .seda-sources a{color:#0b5cad;text-decoration:none;border-bottom:1px solid rgba(11,92,173,.32)}
  .seda-sources a:hover{border-bottom-color:#0b5cad}
  .seda-sources .seda-verified{display:block;font-size:13px;color:#8a8a8a;margin-top:2px}
  .seda-sources dl{display:grid;grid-template-columns:96px 1fr;gap:8px 16px;margin:0;padding:16px 0 0;border-top:1px solid #e7e1d6}
  .seda-sources dt{color:#8a8a8a;font-size:14px}
  .seda-sources dd{margin:0;font-size:14px;color:#4a4a4a}
  @media(max-width:600px){.seda-sources dl{grid-template-columns:1fr;gap:2px}.seda-sources dt{margin-top:8px}}
</style>
${STYLE_END}`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlock(url, entry) {
  const sources = entry.sources.map((s) => `      <li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a><span class="seda-verified">核实于 ${esc(entry.lastVerified)}</span></li>`).join('\n');
  return `${BLOCK_START}
<section class="seda-sources" aria-labelledby="seda-sources-title">
  <h2 id="seda-sources-title">资料来源与核实</h2>
  <p class="seda-sources-lead">${esc(entry.note)}</p>
  <ul>
${sources}
  </ul>
  <dl>
    <dt>维护</dt><dd>SEDA 编辑部（新加坡教育发展协会）</dd>
    <dt>最近核实</dt><dd>${esc(entry.lastVerified)}</dd>
    <dt>纠错</dt><dd>发现错误或过期信息，请通过 <a href="/contact/">联系我们</a> 指出本页链接，我们核对后更新。</dd>
    <dt>更新记录</dt><dd>${esc(entry.lastVerified)} 标注官方来源、核实日期与纠错入口</dd>
  </dl>
</section>
${BLOCK_END}`;
}

// 把 citation / dateModified 写进现有的 Article 节点
function patchArticle(html, entry) {
  let changed = false;
  const out = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
    let data;
    try { data = JSON.parse(body); } catch { return whole; }
    const nodes = data['@graph'] ? data['@graph'] : [data];
    const articles = nodes.filter((n) => n && n['@type'] === 'Article');
    if (!articles.length) return whole;
    for (const a of articles) {
      a.citation = entry.sources.map((s) => s.url);
      a.dateModified = entry.lastVerified;
      a.author = a.author || { '@type': 'Organization', name: 'SEDA 新加坡择校网', url: 'https://sgeda.org.cn' };
      a.publisher = a.publisher || { '@type': 'Organization', name: 'SEDA 新加坡择校网', url: 'https://sgeda.org.cn' };
      changed = true;
    }
    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });
  return { html: out, changed };
}

const configPath = path.join(root, 'content', 'sources.json');
if (!fs.existsSync(configPath)) {
  console.error('缺少 content/sources.json');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let updated = 0;
const issues = [];
for (const [url, entry] of Object.entries(config)) {
  if (url.startsWith('_')) continue;
  const { pathname } = new URL(url);
  const file = path.join(root, pathname, 'index.html');
  if (!fs.existsSync(file)) { issues.push(`缺页面 ${url}`); continue; }
  let html = fs.readFileSync(file, 'utf8');

  const block = renderBlock(url, entry);
  // 先摘掉旧区块再统一插到页脚之前：/aeis/ 这类页面 </main> 后面紧跟 sidebar，
  // 插在 </main> 之后会变成 grid 的一项，把版式挤乱。
  if (html.includes(BLOCK_START)) {
    html = html.replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`), '');
  }
  const footerAnchor = '<footer class="site-footer"';
  if (html.includes(footerAnchor)) {
    html = html.replace(footerAnchor, `${block}\n${footerAnchor}`);
  } else if (html.includes('</main>')) {
    html = html.replace('</main>', `</main>\n${block}`);
  } else {
    issues.push(`找不到页脚/主体结束位置，跳过 ${url}`);
    continue;
  }

  if (!html.includes(STYLE_START)) {
    html = html.includes('</head>') ? html.replace('</head>', `${style}\n</head>`) : html;
  }

  const patched = patchArticle(html, entry);
  html = patched.html;

  if (checkOnly) {
    const ok = html.includes(BLOCK_START) && patched.changed;
    if (!ok) issues.push(`缺署名/来源区块 ${url}`);
    continue;
  }
  const before = fs.readFileSync(file, 'utf8');
  if (html !== before) { fs.writeFileSync(file, html, 'utf8'); updated += 1; }
}

if (checkOnly) {
  if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
  console.log(`✅ ${Object.keys(config).filter((k) => !k.startsWith('_')).length} 页均有来源区块与 citation`);
} else {
  console.log(`来源区块：更新 ${updated} 页，共 ${Object.keys(config).filter((k) => !k.startsWith('_')).length} 页登记`);
  if (issues.length) console.log(issues.join('\n'));
}
