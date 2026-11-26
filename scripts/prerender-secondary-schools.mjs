// 把 secondary-schools 的 146 所学校卡片预渲染为静态 HTML（SEO/GEO：让不执行 JS 的
// 爬虫看到完整数据库）。JS 端 applyFilters() 首次渲染会覆盖同构内容，用户体验不变。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 页面 schools 数组是静态预渲染与运行时筛选共同使用的唯一链接源。
export function readSecondarySchools(html) {
  const m = html.match(/const schools = \[([\s\S]*?)\n\s*\];/);
  if (!m) throw new Error('schools array not found');
  const schools = new Function(`return [${m[1]}];`)();
  if (schools.length !== 146) throw new Error(`unexpected school count: ${schools.length}`);
  const names = new Set();
  const links = new Set();
  for (const school of schools) {
    if (!school.name || names.has(school.name)) throw new Error(`duplicate or missing school name: ${school.name}`);
    if (typeof school.link !== 'string' || !/^\/secondary-schools\/[a-z0-9-]+\/$/.test(school.link)) {
      throw new Error(`invalid school link: ${school.name}`);
    }
    if (links.has(school.link)) throw new Error(`duplicate school target: ${school.link}`);
    names.add(school.name);
    links.add(school.link);
  }
  return schools;
}

// 纯内存入口：测试可验证重建结果，不执行生成器或改写仓库文件。
export function prerenderSecondarySchools(html) {
  const schools = readSecondarySchools(html);

  // —— 与页面 renderCards 完全同构的生成逻辑 ——
  const copClass = c => c === null ? 'cop-na' : c <= 9 ? 'cop-red' : c <= 17 ? 'cop-yellow' : 'cop-green';
  const copAccent = c => c === null ? 'cop-n' : c <= 9 ? 'cop-r' : c <= 17 ? 'cop-y' : 'cop-g';
  const copLabel = c => c === null ? 'N/A' : c;
  const getInitials = name => {
    const words = name.replace(/\(.*?\)/g, '').replace(/School|Secondary|High/gi, '').trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].substring(0, 2).toUpperCase();
  };

  const list = schools.slice().sort((a, b) => {
    if (a.cop === null && b.cop === null) return 0;
    if (a.cop === null) return 1;
    if (b.cop === null) return -1;
    return a.cop - b.cop;
  });

  const cards = list.map(s => {
    let badges = '';
    s.programs.forEach(p => { badges += '<span class="badge-' + p.toLowerCase() + '">' + p + '</span>'; });
    if (s.name.includes("Girls'") || s.cn.includes('女')) badges += '<span class="badge-girls">Girls\'</span>';
    const nameHtml = s.link ? '<a href="' + s.link + '" style="color:inherit;text-decoration:none">' + s.name + '</a>' : s.name;
    const ac = copAccent(s.cop);
    return '<div class="school-card"' + (s.link ? ' onclick="location.href=\'' + s.link + '\'" style="cursor:pointer"' : '') + '>' +
      '<div class="card-accent ' + ac + '"></div>' +
      '<div class="card-body">' +
        '<div class="card-header">' +
          '<div class="card-avatar ' + ac + '">' + getInitials(s.name) + '</div>' +
          '<div class="card-info">' +
            '<div class="card-top"><h3>' + nameHtml + '<small>' + s.cn + '</small></h3><span class="cop-badge ' + copClass(s.cop) + '">' + copLabel(s.cop) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="school-meta">' +
          '<span class="area-tag">📍 ' + s.area + '</span>' +
          '<span class="type-tag">' + s.type + '</span>' +
        '</div>' +
        (badges ? '<div class="program-badges">' + badges + '</div>' : '') +
        '<p class="desc">' + s.desc + '</p>' +
      '</div>' +
      '<div class="card-footer">' +
        '<span class="loc">COP: ' + (s.cop !== null ? s.cop : 'N/A') + '</span>' +
        (s.link ? '<span class="arrow">查看详情 →</span>' : '') +
      '</div>' +
    '</div>';
  }).join('\n');

  // 注入到 #schoolGrid 容器（替换其现有内容）
  const gridRe = /(<div class="school-grid" id="schoolGrid">)[\s\S]*?(<\/div>\s*<div class="no-results")/;
  if (!gridRe.test(html)) throw new Error('schoolGrid container boundary not found');
  return html.replace(gridRe, (_, open, close) => `${open}\n<!-- 静态预渲染：146所学校（按COP升序），JS筛选会接管本区域 -->\n${cards}\n${close}`);
}

// 只有明确通过 CLI 运行本脚本时才写入；import 不触发任何文件生成。
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = 'secondary-schools/index.html';
  const html = fs.readFileSync(file, 'utf8');
  const output = prerenderSecondarySchools(html);
  fs.writeFileSync(file, output);
  console.log('✅ 预渲染 146 所学校卡片进静态 HTML');
}
