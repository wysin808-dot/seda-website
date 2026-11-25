// 版式变体：给「同一套 hero」的页面分不同背景，避免几百页第一屏完全一样。
//
// 背景：414 个学校页共用 .school-hero 的同一张图，36 个院校页共用
// .hero-pathway。百度按模板站处理，用户连着看两页也会觉得是同一个页面。
//
// 做法（确定性，构建时执行）：
//   1. 学校页：按 URL 哈希从 6 张实景图里选一张，写成行内 background
//   2. 院校页（hero-pathway）：每 3 页有 1 页改成轻 hero（白底细线）
//
// 幂等：已带 data-hero 的 section 会被重新计算并覆盖。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGES = [
  '/assets/sg-px-14694917.jpg',
  '/assets/sg-px-20779788.jpg',
  '/assets/sg-px-32818048.jpg',
  '/assets/sg-px-36882343.jpg',
  '/assets/sg-px-37182575.jpg',
  '/assets/sg-px-6305534.jpg',
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function varyHero(root, { checkOnly = false } = {}) {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  let school = 0;
  let pathway = 0;
  for (const url of urls) {
    const { pathname } = new URL(url);
    const file = path.join(root, pathname, 'index.html');
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    const before = html;

    // 1) 学校页轮换背景图
    if (html.includes('<section class="page-hero school-hero"')) {
      const img = IMAGES[hash(pathname) % IMAGES.length];
      const style = `background:var(--hero-overlay),url('${img}') center 30%/cover no-repeat`;
      html = html.replace(
        /<section class="page-hero school-hero"[^>]*>/,
        `<section class="page-hero school-hero" data-hero="${hash(pathname) % IMAGES.length}" style="${style}">`,
      );
    }

    // 2) 院校页每 3 张换 1 张轻 hero
    if (html.includes('hero-pathway') && hash(pathname) % 3 === 0) {
      html = html.replace(
        /class="page-hero content-hero hero-pathway"/,
        'class="page-hero content-hero hero-pathway cp-hero--light"',
      );
      if (!html.includes('seda-content.css')) {
        const link = html.match(/<link rel="stylesheet" href="\/seda-site\.css\?v=\d+"\s*\/?>/);
        if (link) html = html.slice(0, link.index + link[0].length) + '\n<link rel="stylesheet" href="/seda-content.css?v=1"/>' + html.slice(link.index + link[0].length);
      }
    }

    if (html !== before) {
      if (!checkOnly) fs.writeFileSync(file, html, 'utf8');
      if (html.includes('school-hero')) school += 1;
      if (html.includes('cp-hero--light')) pathway += 1;
    }
  }
  return { school, pathway, total: urls.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { school, pathway } = varyHero(root, { checkOnly: process.argv.includes('--check') });
  console.log(`hero 变体：学校页 ${school} 页换了背景，院校页 ${pathway} 页调整了版式`);
}
