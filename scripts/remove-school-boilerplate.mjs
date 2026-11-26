import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const SENTINEL = '如果孩子英文基础稳定、自我管理能力较强';
const GENERIC_PARAGRAPHS = [
  /^如果孩子英文基础稳定、自我管理能力较强/,
  /^对中国学生来说，选校不能只问/,
  /^SEDA 建议家长把预算分成四块看/,
  /^真正稳妥的选校，不是只选/,
  /^很多家长第一次搜索/,
  /^家长在比较 .* 时，不建议只看/,
  /^如果学生目标是新加坡长期发展/,
  /^小学阶段看似离大学很远/,
  /^中学阶段是新加坡教育体系里非常关键的分水岭/,
  /^国际学校的重点不只是学费和校园/,
  /^私立学校和私立教育机构的重点不是/,
  /^.*的关键词可以概括为：.*这些标签不能直接等同于/,
  /对中国家长有天然吸引力|代表新加坡精英教育|不是简单的.*好学校推荐|本地顶尖学生高度集中的学校/,
  /^(?:Furen 更偏考试和升学导向，适合和|Insworld 属于私立国际课程学校，适合与|Kaplan 属于新加坡主流私立教育机构之一，适合和|MDIS 适合希望在综合型私立学院里比较|三育中小学适合希望比较|San Yu 更接近私立中小学路径，适合与|St\. Francis Methodist School 适合希望比较)/,
];
const BOILERPLATE_SUFFIX = /\s*(?:家长选择这类小学时，重点不是只看名气|对中国学生来说，选择中学要同时看英文适应)[\s\S]*$/;
const text = value => String(value || '').replace(/\s+/g, ' ').trim();
const cleanType = value => text(value).replace(/\s*\/\s*(?:参考\s*COP\s*\d+|Tier\s*\d+[^/]*)/gi, '').trim();

function removeHeadingBlock($, heading) {
  const nodes = heading.nextUntil('h2,section');
  nodes.remove();
  heading.remove();
}

// Only migrate the identifiable old school template, not hand-written FAQ,
// reviewed policy pages or shared navigation. No fake examples are introduced.
export function removeSchoolBoilerplate(html) {
  if (html.includes('<!-- SEDA_CUSTOM_PAGE -->')) return html;
  if (!html.includes(SENTINEL) && !html.includes('data-school-record-note')) return html;
  const $ = load(html);
  const article = $('main .content-main').first();
  if (!article.length) return html;
  article.find('section.seo-tags, section[aria-labelledby="school-quick-answer"], section[aria-labelledby="school-quick-summary"], section[aria-labelledby="school-checklist"]').remove();
  article.find('section.faq-section').each((_, el) => {
    const questions = $(el).find('summary').map((_, q) => text($(q).text())).get();
    if (questions.length === 4 && questions[0].endsWith('适合中国学生吗？') && questions[3].startsWith('如果进不了')) $(el).remove();
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    let data;
    try { data = JSON.parse($(el).text()); } catch { return; }
    const isGenericFaq = node => node?.['@type'] === 'FAQPage' && node.mainEntity?.length === 4 && node.mainEntity[0].name?.endsWith('适合中国学生吗？') && node.mainEntity[3].name?.startsWith('如果进不了');
    if (isGenericFaq(data)) { $(el).remove(); return; }
    if (data['@graph']) {
      const before = data['@graph'].length;
      data['@graph'] = data['@graph'].filter(n => !isGenericFaq(n));
      if (before !== data['@graph'].length) $(el).text(JSON.stringify(data).replace(/</g, '\\u003c'));
    }
  });
  article.find('h2').each((_, el) => {
    const heading = $(el), title = text(heading.text());
    if (title === '中国家长怎么选？') removeHeadingBlock($, heading);
    if (['费用和家庭预算', '入学路径怎么理解？'].includes(title)) {
      const copy = heading.nextUntil('h2,section').text();
      // A real fee table or sourced admission detail is not boilerplate.
      if (!/S\$|\bSGD\b|href=|官方来源|\d{4}/.test(copy) && !heading.nextUntil('h2,section').find('table,a').length) removeHeadingBlock($, heading);
    }
    if (/是什么类型的学校？$/.test(title)) heading.text('学校记录');
    if (title === '学校特色与适合学生') heading.text('现有课程记录');
    if (['学校特色与适合学生','现有课程记录'].includes(title)) {
      heading.nextUntil('h2,section').filter('ul').find('li').each((_, item) => {
        if (/^Government$|^Government-Aided$|^Independent$|适合.*比较|顶尖|精英|热门|关注度高|性价比|优质|成熟/.test(text($(item).text()))) $(item).remove();
      });
      heading.nextUntil('h2,section').filter('ul').each((_, list) => { if (!$(list).find('li').length) $(list).remove(); });
      if (!heading.nextUntil('h2,section').filter('ul').find('li').length) heading.remove();
    }
  });
  article.find('p').each((_, el) => {
    const p = $(el), copy = text(p.text());
    if (p.closest('.related-section,.cp-soft-cta,.contact-section,.seda-sources').length) return;
    if (GENERIC_PARAGRAPHS.some(re => re.test(copy))) { p.remove(); return; }
    if (BOILERPLATE_SUFFIX.test(copy) && !p.find('a,strong,em').length) p.text(copy.replace(BOILERPLATE_SUFFIX, '').trim());
  });
  article.find('h2').each((_, el) => {
    const heading = $(el);
    if (/适合什么学生？$|在新加坡教育体系里的定位$/.test(text(heading.text())) && !text(heading.nextUntil('h2,section').text())) heading.remove();
  });
  article.find('.stats-bar .num').each((_, el) => $(el).text(cleanType($(el).text())));
  if (!article.find('[data-school-record-note]').length) {
    article.find('.related-section').first().before('<p data-school-record-note>本页部分学校资料尚待逐项核实；未标年度与官方来源的旧数据不作为申请依据。招生政策请查阅栏目指南与学校官网。</p>');
  }
  // Do not advertise COP/IP/fee guides which the remaining record cannot supply.
  const entity = $('script[type="application/ld+json"]').toArray().map(el => {
    try { return JSON.parse($(el).text()); } catch { return null; }
  }).find(node => ['EducationalOrganization','School','CollegeOrUniversity'].includes(node?.['@type']));
  if (entity?.name) {
    const title = `${entity.name}（${entity.alternateName || entity.name}）学校资料`;
    const description = `${entity.name}学校记录：${entity.alternateName || entity.name}，${text(entity.address)}。查看已有课程资料及相关入学指南；具体项目和申请要求需按官方当期资料核对。`;
    $('head > title').text(`${title} | SEDA 新加坡择校网`);
    $('h1').first().text(title);
    $('meta[name="description"]').attr('content', description);
    $('meta[property="og:title"],meta[name="twitter:title"]').attr('content', `${title} | SEDA 新加坡择校网`);
    $('meta[property="og:description"],meta[name="twitter:description"]').attr('content', description);
    $('p.hero-subtitle').first().text(description);
    $('meta[name="keywords"]').attr('content', [entity.name,entity.alternateName,'新加坡学校资料'].filter(Boolean).join(','));
    $('script[type="application/ld+json"]').each((_, el) => {
      let data; try { data = JSON.parse($(el).text()); } catch { return; }
      const patch = node => {
        if (['WebPage','EducationalOrganization','School','CollegeOrUniversity'].includes(node?.['@type'])) {
          node.description = description;
          if (node['@type'] === 'WebPage') { node.name = title; node.headline = title; }
          delete node.about;
          delete node.knowsAbout;
          delete node.educationalCredentialAwarded;
          if (node.mainEntity) patch(node.mainEntity);
        }
      };
      for (const node of data['@graph'] || [data]) patch(node);
      $(el).text(JSON.stringify(data).replace(/</g, '\\u003c'));
    });
  }
  // HTML parsing moves the POSIX newline after </html> into the body; normalize
  // it so a repeated migration does not accumulate blank lines before </body>.
  const tail = $('body').contents().last()[0];
  if (tail?.type === 'text') tail.data = tail.data.trimEnd() + '\n';
  else $('body').append('\n');
  return $.html().replace(/[ \t]+$/gm, '').trimEnd() + '\n';
}

export function cleanLegacySchoolPages(root) {
  let updated = 0;
  for (const base of ['primary-schools','secondary-schools','jc','poly','university','international-school','private-schools']) {
    const dir = path.join(root, base);
    if (!fs.existsSync(dir)) continue;
    function visit(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.name === 'index.html') {
          const before = fs.readFileSync(file, 'utf8');
          const after = removeSchoolBoilerplate(before);
          if (after !== before) { fs.writeFileSync(file, after, 'utf8'); updated += 1; }
        }
      }
    }
    visit(dir);
  }
  return { updated };
}
