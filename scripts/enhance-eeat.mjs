// 维护 content/sources.json 中已登记页面的真实 citation 元数据。
// 来源、核实日期和范围只保存在维护记录中，不生成前台统一来源模块或样式。
// 写入时清除历史 SEDA_SOURCES / SEDA_SOURCES_STYLE 标记块（含旧 details 版）。
// 不代表未登记学校已经核实，也不承诺搜索引擎收录或排名。
//
//   node scripts/enhance-eeat.mjs           # 清理旧模块并写入 citation
//   node scripts/enhance-eeat.mjs --check   # 只检查维护记录与 citation，不写入
//   import { applySources } from './enhance-eeat.mjs'  // build-content.mjs 内调用
// 在生成 sitemap fingerprint 前调用；重复执行不改变 HTML。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CITATION_START = '<!-- SEDA_CITATION_START -->';
const CITATION_END = '<!-- SEDA_CITATION_END -->';
const jsonLdPattern = /(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/g;

function removeLegacySources(html) {
  return html
    .replace(/<!-- SEDA_SOURCES_START -->[\s\S]*?<!-- SEDA_SOURCES_END -->\r?\n?/g, '')
    .replace(/<!-- SEDA_SOURCES_STYLE_START -->[\s\S]*?<!-- SEDA_SOURCES_STYLE_END -->\r?\n?/g, '');
}

function targetNodes(data) {
  const nodes = Array.isArray(data) ? data : (data?.['@graph'] || [data]);
  return nodes.filter(node => {
    const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
    return types.some(type => ['Article', 'WebPage', 'CollectionPage'].includes(type));
  });
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function recordIssues(url, entry) {
  const issues = [];
  let canonical;
  try { canonical = new URL(url); } catch { /* reported below */ }
  if (!canonical || !validHttpsUrl(url) || canonical.origin !== 'https://sgeda.org.cn'
    || !canonical.pathname.endsWith('/') || canonical.search || canonical.hash
    || canonical.pathname.split('/').some(part => part === '.' || part === '..')) {
    issues.push(`无效页面 canonical ${url}`);
  }
  const date = entry?.lastVerified;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    issues.push(`无效 lastVerified ${url}`);
  }
  if (typeof entry?.note !== 'string' || !entry.note.trim()) issues.push(`缺核实范围记录 ${url}`);
  if (!Array.isArray(entry?.sources) || !entry.sources.length) {
    issues.push(`缺真实来源记录 ${url}`);
  } else {
    for (const source of entry.sources) {
      if (typeof source?.label !== 'string' || !source.label.trim() || !validHttpsUrl(source?.url)) {
        issues.push(`无效来源记录 ${url}`);
      }
    }
    if (new Set(entry.sources.map(source => source?.url)).size !== entry.sources.length) {
      issues.push(`重复来源记录 ${url}`);
    }
  }
  return issues;
}

function checkCitation(html, url, entry) {
  const issues = [];
  const targets = [];
  for (const match of html.matchAll(jsonLdPattern)) {
    try { targets.push(...targetNodes(JSON.parse(match[2]))); }
    catch { issues.push(`无效 JSON-LD ${url}`); }
  }
  if (!targets.length) issues.push(`缺 Article/WebPage citation 实体 ${url}`);
  const citation = entry.sources.map(source => source.url);
  for (const node of targets) {
    if (JSON.stringify(node.citation) !== JSON.stringify(citation)) issues.push(`citation 与维护记录不一致 ${url}`);
    if (node.dateModified !== entry.lastVerified) issues.push(`dateModified 与维护记录不一致 ${url}`);
  }
  return issues;
}

function patchCitation(html, url, entry) {
  let found = false;
  html = html.replace(jsonLdPattern, (whole, open, body, close) => {
    let data;
    try { data = JSON.parse(body); } catch { return whole; }
    const targets = targetNodes(data);
    if (!targets.length) return whole;
    found = true;
    let changed = false;
    for (const node of targets) {
      const citation = entry.sources.map(source => source.url);
      if (JSON.stringify(node.citation) !== JSON.stringify(citation) || node.dateModified !== entry.lastVerified) {
        node.citation = citation;
        node.dateModified = entry.lastVerified;
        changed = true;
      }
    }
    // 保留已同步的脚本字节、发表日期和其他元数据，不用构建日期冒充核实日期。
    return changed ? `${open}${JSON.stringify(data)}${close}` : whole;
  });
  if (found) return html;
  const node = {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': url, url,
    inLanguage: 'zh-CN', dateModified: entry.lastVerified,
    citation: entry.sources.map(source => source.url),
  };
  const block = `${CITATION_START}\n<script type="application/ld+json">${JSON.stringify(node)}</script>\n${CITATION_END}`;
  if (html.includes(CITATION_START)) {
    return html.replace(new RegExp(`${CITATION_START}[\\s\\S]*?${CITATION_END}`, 'g'), block);
  }
  return html.includes('</head>') ? html.replace('</head>', `${block}\n</head>`) : html;
}

function* htmlFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield file;
  }
}

export function applySources(root, { checkOnly = false } = {}) {
  const configPath = path.join(root, 'content', 'sources.json');
  if (!fs.existsSync(configPath)) throw new Error('缺少 content/sources.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const urls = Object.keys(config).filter(key => !key.startsWith('_'));
  const handled = new Set();
  const issues = [];
  let updated = 0;
  for (const url of urls) {
    const entry = config[url];
    const invalid = recordIssues(url, entry);
    if (invalid.length) { issues.push(...invalid); continue; }
    const file = path.join(root, new URL(url).pathname, 'index.html');
    if (!fs.existsSync(file)) { issues.push(`缺页面 ${url}`); continue; }
    const before = fs.readFileSync(file, 'utf8');
    handled.add(file);
    if (checkOnly) {
      // 不依赖可见来源区块或 footer/main：只检查真实维护记录及对应元数据。
      issues.push(...checkCitation(before, url, entry));
      continue;
    }
    const html = patchCitation(removeLegacySources(before), url, entry);
    issues.push(...checkCitation(html, url, entry));
    if (html !== before) { fs.writeFileSync(file, html, 'utf8'); updated += 1; }
  }
  if (!checkOnly) {
    // 曾登记但现已移出清单的页面，也不能遗留旧统一来源模块。
    for (const file of htmlFiles(root)) {
      if (handled.has(file)) continue;
      const before = fs.readFileSync(file, 'utf8');
      const html = removeLegacySources(before);
      if (html !== before) { fs.writeFileSync(file, html, 'utf8'); updated += 1; }
    }
  }
  return { updated, total: urls.length, issues };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const { updated, total, issues } = applySources(root, { checkOnly });
  if (issues.length) console.log(issues.join('\n'));
  console.log(checkOnly
    ? `${total} 页来源维护记录与 citation 检查完成`
    : `来源维护：更新 ${updated} 页，共 ${total} 页登记；不生成前台来源模块`);
  if (issues.length) process.exit(1);
}
