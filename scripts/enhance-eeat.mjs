// 给指定页面注入「资料来源与核实」区块 + Article.citation 结构化数据。
//
// 背景：百度把「正确但无出处」的页面当作低质/AI 内容。这个脚本给每页补上
// 可核验的一手来源、最近核实日期、维护方与纠错入口，并把来源写进 Article
// 的 citation 字段（结构化数据必须与可见内容一致）。
//
// 数据源：content/sources.json
// 用法：
//   node scripts/enhance-eeat.mjs           # 写入
//   node scripts/enhance-eeat.mjs --check   # 只检查，不写（CI 用）
//   import { applySources } from './enhance-eeat.mjs'  // build-content.mjs 内调用
//
// 幂等：以 <!-- SEDA_SOURCES_START --> / END 为界替换，重复运行不会叠加。
// 必须在写文章正文之后、生成 sitemap 之前调用，否则 fingerprint 会漏掉这一块。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function renderBlock(entry) {
  const sources = entry.sources
    .map((s) => `      <li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.label)}</a><span class="seda-verified">核实于 ${esc(entry.lastVerified)}</span></li>`)
    .join('\n');
  return `${BLOCK_START}
<section class="seda-sources" aria-labelledby="seda-sources-title">
  <h2 id="seda-sources-title">资料来源与核实</h2>
  <p class="seda-sources-lead">${esc(entry.note)}</p>
  <ul>
${sources}
  </ul>
  <dl>
    <dt>维护</dt><dd><a href="/about/#editorial">SEDA 编辑部（新加坡教育发展协会）</a></dd>
    <dt>最近核实</dt><dd>${esc(entry.lastVerified)}</dd>
    <dt>纠错</dt><dd>发现错误或过期信息，请通过 <a href="/contact/">联系我们</a> 指出本页链接，我们核对后更新。</dd>
    <dt>更新记录</dt><dd>${esc(entry.lastVerified)} 标注官方来源、核实日期与纠错入口</dd>
  </dl>
</section>
${BLOCK_END}`;
}

// 把 citation / dateModified 写进现有的 Article 节点
// 页面没有 Article/WebPage 实体时，单独补一个 WebPage 节点承载 citation。
const CITATION_START = '<!-- SEDA_CITATION_START -->';
const CITATION_END = '<!-- SEDA_CITATION_END -->';
function addCitationScript(html, url, entry) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    inLanguage: 'zh-CN',
    dateModified: entry.lastVerified,
    citation: entry.sources.map((s) => s.url),
  };
  const block = `${CITATION_START}\n<script type="application/ld+json">${JSON.stringify(node)}</script>\n${CITATION_END}`;
  if (html.includes(CITATION_START)) {
    return html.replace(new RegExp(`${CITATION_START}[\\s\\S]*?${CITATION_END}`), block);
  }
  return html.includes('</head>') ? html.replace('</head>', `${block}\n</head>`) : html;
}

function patchArticle(html, entry) {
  let changed = false;
  const out = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
    let data;
    try { data = JSON.parse(body); } catch { return whole; }
    const nodes = data['@graph'] ? data['@graph'] : [data];
    // 有 Article 就写 Article；没有就退到 WebPage，保证 citation 至少挂在主实体上。
    let targets = nodes.filter((n) => n && n['@type'] === 'Article');
    if (!targets.length) targets = nodes.filter((n) => n && (n['@type'] === 'WebPage' || n['@type'] === 'CollectionPage'));
    if (!targets.length) return whole;
    for (const a of targets) {
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

export function applySources(root, { checkOnly = false } = {}) {
  const configPath = path.join(root, 'content', 'sources.json');
  if (!fs.existsSync(configPath)) throw new Error('缺少 content/sources.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  let updated = 0;
  const issues = [];
  const urls = Object.keys(config).filter((k) => !k.startsWith('_'));
  for (const url of urls) {
    const entry = config[url];
    const { pathname } = new URL(url);
    const file = path.join(root, pathname, 'index.html');
    if (!fs.existsSync(file)) { issues.push(`缺页面 ${url}`); continue; }
    const before = fs.readFileSync(file, 'utf8');
    let html = before;

    const block = renderBlock(entry);
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
    if (!patched.changed) {
      // 没有 Article/WebPage 实体：补一个 WebPage 节点，别让 citation 无处安放
      html = addCitationScript(html, url, entry);
    }

    if (checkOnly) {
      if (!before.includes(BLOCK_START)) issues.push(`缺来源区块 ${url}`);
      continue;
    }
    if (html !== before) { fs.writeFileSync(file, html, 'utf8'); updated += 1; }
  }
  return { updated, total: urls.length, issues };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const { updated, total, issues } = applySources(root, { checkOnly });
  if (issues.length) console.log(issues.join('\n'));
  console.log(checkOnly
    ? `✅ ${total} 页来源区块检查完成`
    : `来源区块：更新 ${updated} 页，共 ${total} 页登记`);
  if (checkOnly && issues.length) process.exit(1);
}
