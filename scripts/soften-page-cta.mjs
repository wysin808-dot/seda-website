// 把内容页底部的整块咨询卡降级成一句安静的文字链接。
//
// 问题：477 个页面共用同一个 <section class="contact-section">——
// 红色按钮 + 微信二维码 + 三行说明。它出现在每一页末尾，视觉上完全
// 相同，是整站最明显的「模板感」来源，也稀释了真正需要转化的页面。
//
// 策略：只保留首页、/contact/ 和各栏目落地页的完整 CTA，其余内容页
// 换成一行文字链接。导航栏的「免费咨询」和页脚联系方式仍然全站可达，
// 转化路径没有断。
//
// 用法：node scripts/soften-page-cta.mjs [--check] [--dry]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARK = '<!-- SEDA_SOFT_CTA -->';

// 保留完整 CTA 的页面：首页、联系页、各栏目落地页
const KEEP = new Set([
  '/', '/contact/',
  '/aeis/', '/o-level/', '/wace/', '/ossd/',
  '/jc/', '/poly/', '/university/', '/private-university/',
  '/international-school/', '/primary-schools/', '/secondary-schools/', '/private-schools/',
  '/guides/', '/school-database/', '/about/', '/news/', '/pathways/',
]);

// 按栏目给一句不一样的话，避免新的整站统一文案
const LINES = {
  aeis: ['还在纠结孩子该考哪一轮？', '说说现在几年级，我们帮你对一遍可报年级和考试窗口。'],
  'o-level': ['JC 和 Poly 还没定？', '把科目组合和目标发来，我们把两条路的分数要求摊开比。'],
  wace: ['WACE 的选科和 ATAR 还没对上？', '把孩子现在的课程和目标大学发来，我们逐项核一遍。'],
  ossd: ['OSSD 的学分转换还没算清？', '把已修课程发来，我们按安省的要求帮你估一遍。'],
  jc: ['JC 的 L1R5 还没算过？', '把成绩结构发来，我们按今年的框架帮你排一遍可报的 JC。'],
  poly: ['Poly 专业还没选？', '把你的目标专业和预计分数发来，我们对照 ELR2B2 看可行性。'],
  university: ['目标专业还没倒推选校？', '说说成绩结构和目标专业，我们按门槛给你一份可申请名单。'],
  'private-university': ['私立大学的认证还没核实？', '把目标专业发来，我们帮你核清学位授予方和认证情况。'],
  'international-school': ['国际学校还没筛到 3 所？', '说说孩子的情况，我们按课程、学费和通勤帮你缩小范围。'],
  'primary-schools': ['插班这条路还没确认？', '说说孩子现在几年级，我们判断空余学额和年级衔接。'],
  'secondary-schools': ['COP 和孩子成绩还没对上？', '把预计分数发来，我们逐项对照往年数据和科目要求。'],
  'private-schools': ['这所学校能不能保底？', '告诉我们目标，我们确认它能不能承接你家的那条路。'],
  guides: ['行前还有哪一步没准备？', '说说现在的进度，我们看看还缺哪一环。'],
  news: ['这条政策影响你家孩子吗？', '说说孩子的情况，我们判断要不要调整计划。'],
  'singapore-education': ['想弄清这个阶段的入学规则？', '把孩子的年级和目标发来，我们按现行规则帮你对一遍。'],
};
const FALLBACK = ['还有具体问题没解决？', '把孩子的年级、英文水平和目标发来，我们给一个具体判断，不列一堆选项。'];

function pick(pathname) {
  const seg = pathname.split('/').filter(Boolean)[0] || '';
  return LINES[seg] || FALLBACK;
}

export function softenCta(root, { checkOnly = false } = {}) {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  let softened = 0;
  let kept = 0;
  for (const url of urls) {
    const { pathname } = new URL(url);
    const file = path.join(root, pathname, 'index.html');
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (KEEP.has(pathname)) { kept += 1; continue; }
    const m = html.match(/<section class="contact-section"[\s\S]*?<\/section>\n?/);
    const softRe = /<!-- SEDA_SOFT_CTA -->[\s\S]*?<\/section>\n?/;
    if (!m && !softRe.test(html)) continue;

    const [lead, body] = pick(pathname);
    const soft = `${MARK}
<section class="cp-soft-cta" id="contact">
  <p>${lead} <a href="/contact/">${body}</a></p>
</section>
`;
    const next = m ? html.replace(m[0], soft) : html.replace(softRe, soft);
    if (checkOnly) { softened += 1; continue; }
    fs.writeFileSync(file, next, 'utf8');
    softened += 1;
  }
  return { softened, kept, total: urls.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const checkOnly = process.argv.includes('--check');
  const { softened, kept } = softenCta(root, { checkOnly });
  console.log(checkOnly
    ? `CTA 检查：仍有 ${softened} 页使用整块咨询卡（应为 ${kept} 页）`
    : `CTA 瘦身：${softened} 页改为文字链接，${kept} 页保留完整咨询卡`);
}
