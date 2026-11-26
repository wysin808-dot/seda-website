// 详情页只保留一个联系入口。共享导航不需要伪装成每页独有的建议，
// 也不承诺判断空余学额、确认保底录取或给出可申请名单。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARK = '<!-- SEDA_SOFT_CTA -->';
const KEEP = new Set([
  '/', '/contact/',
  '/aeis/', '/o-level/', '/wace/', '/ossd/',
  '/jc/', '/poly/', '/university/', '/private-university/',
  '/international-school/', '/primary-schools/', '/secondary-schools/', '/private-schools/',
  '/guides/', '/school-database/', '/about/', '/news/', '/pathways/',
]);

export function softenCta(root, { checkOnly = false } = {}) {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  let softened = 0;
  let kept = 0;
  for (const url of urls) {
    const { pathname } = new URL(url);
    const file = path.join(root, pathname, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (KEEP.has(pathname)) { kept += 1; continue; }
    const fullRe = /<section class="contact-section"[\s\S]*?<\/section>\n?/;
    const softRe = /<!-- SEDA_SOFT_CTA -->[\s\S]*?<\/section>\n?/;
    const pattern = fullRe.test(html) ? fullRe : softRe;
    if (!pattern.test(html)) continue;
    const soft = `${MARK}\n<section class="cp-soft-cta" id="contact">\n  <p><a href="/contact/">联系 SEDA · 咨询或更正本页信息</a></p>\n</section>\n`;
    const next = html.replace(pattern, soft);
    if (next === html) continue;
    if (!checkOnly) fs.writeFileSync(file, next, 'utf8');
    softened += 1;
  }
  return { softened, kept, total: urls.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const { softened, kept } = softenCta(root, { checkOnly });
  console.log(checkOnly
    ? `咨询入口：${softened} 页待更新，${kept} 页保留栏目入口`
    : `咨询入口：更新 ${softened} 页，${kept} 页保留栏目入口`);
}
