#!/usr/bin/env node
/**
 * check-robots-encoding.mjs
 * 用途：校验 robots.txt 是纯 ASCII 且规则完整，防止构建脚本编码漂移。
 * 用法：
 *   1. CLI 直跑：node scripts/check-robots-encoding.mjs [path/to/robots.txt]
 *   2. 被 build-content.mjs 末尾 import 调用：runCheck(absolutePath)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function runCheck(file) {
  const raw = readFileSync(file); // 不传 encoding，拿原始 Buffer 检查真实字节

  const errors = [];

  // 1. 非 ASCII 字节检查（robots.txt 注释建议纯 ASCII，任何 locale 下打开都不乱码）
  const nonAscii = [];
  for (const [i, byte] of raw.entries()) {
    if (byte > 0x7f) nonAscii.push({ offset: i, byte });
  }
  if (nonAscii.length > 0) {
    const first = nonAscii[0];
    const lineNo = raw.subarray(0, first.offset).filter((b) => b === 0x0a).length + 1;
    errors.push(
      `发现 ${nonAscii.length} 个非 ASCII 字节（首个在第 ${lineNo} 行，偏移 ${first.offset}，0x${first.byte.toString(16)}）。` +
        `UTF-8 中文/破折号虽然合法，但极易被错误 locale 的编辑器二次转码成乱码，建议注释统一用 ASCII。`
    );
  }

  // 2. UTF-8 合法性兜底检查
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    errors.push('文件不是合法 UTF-8，存在真实编码损坏，需从版本库恢复。');
  }

  // 3. 关键规则完整性抽查（防止重编码过程丢行）
  const text = raw.toString('utf8');
  const required = ['User-agent: *', 'Sitemap:'];
  for (const marker of required) {
    if (!text.includes(marker)) errors.push(`缺少关键内容: "${marker}"`);
  }
  const sitemapLines = text
    .split('\n')
    .filter((l) => l.startsWith('Sitemap:'))
    .length;
  if (sitemapLines < 2) errors.push(`Sitemap 行数异常（应为 2 行，实际 ${sitemapLines} 行）`);

  if (errors.length > 0) {
    console.error(`❌ ${file} 编码/内容检查未通过:`);
    for (const e of errors) console.error('  - ' + e);
    throw new Error('robots.txt 编码检查未通过');
  }
  console.log(`✅ ${file}: 纯 ASCII、UTF-8 合法、Sitemap 规则完整（${sitemapLines} 条）`);
  return true;
}

// 仅 CLI 直跑时执行（被 import 时不自动执行）
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runCheck(process.argv[2] ?? 'robots.txt');
  } catch {
    process.exit(1);
  }
}
