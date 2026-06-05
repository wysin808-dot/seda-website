import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const dataFile = path.join(root, 'content', 'schools', 'seo-schools.json');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function extractSchoolsFromIndex(file) {
  const html = read(path.join(root, file));
  const match = html.match(/const schools = (\[[\s\S]*?\n\s*\]);/);
  if (!match) throw new Error(`Cannot find schools array in ${file}`);
  const script = `schools = ${match[1]}`;
  const sandbox = { schools: [] };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox.schools;
}

function slugifyName(name, kind) {
  let value = String(name)
    .replace(/\(Primary\)/gi, '')
    .replace(/\(Secondary\)/gi, '')
    .replace(/\(Junior\)/gi, 'Junior')
    .replace(/\(Independent\)/gi, 'Independent')
    .replace(/\(.*?\)/g, '')
    .replace(/Primary School$/i, '')
    .replace(/Secondary School$/i, '')
    .replace(/High School$/i, 'High')
    .replace(/Junior School$/i, 'Junior')
    .replace(/\bSchool\b$/i, '')
    .replace(/\bPrimary\b$/i, '')
    .replace(/\bSecondary\b$/i, '')
    .trim();
  if (!value) value = String(name);
  const slug = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return slug || `${kind}-school`;
}

function slugFromItem(item, kind) {
  if (item.link) {
    const parts = String(item.link).split('/').filter(Boolean);
    return parts.at(-1);
  }
  return slugifyName(item.name, kind);
}

function primaryTierLabel(tier) {
  const labels = {
    1: 'Tier 1 顶尖热门小学',
    2: 'Tier 2 优质小学',
    3: 'Tier 3 社区小学',
    4: 'Tier 4 社区小学',
  };
  return labels[tier] || '政府小学';
}

function primaryFeatures(item) {
  const features = [...(item.programs || [])];
  if (item.tier === 1) features.push('热门小学', '家长关注度高');
  if (item.tier === 2) features.push('区域口碑较好');
  if (item.tier >= 3) features.push('社区学校', '适合区域择校比较');
  return [...new Set(features)].slice(0, 6);
}

function secondaryFeatures(item) {
  const features = [...(item.programs || [])];
  if (item.type) features.push(item.type);
  if (typeof item.cop === 'number' && item.cop <= 10) features.push('热门中学', '学术竞争强');
  if (typeof item.cop === 'number' && item.cop > 18) features.push('社区中学', '适合稳妥择校比较');
  return [...new Set(features)].slice(0, 6);
}

function primaryToSeo(item) {
  const slug = slugFromItem(item, 'primary');
  const features = primaryFeatures(item);
  const typeLabel = primaryTierLabel(item.tier);
  return {
    type: 'primary',
    categoryLabel: '政府小学',
    basePath: 'primary-schools',
    slug,
    nameZh: item.cn,
    nameEn: item.name,
    location: item.area,
    schoolType: `政府小学 / ${typeLabel}`,
    curriculum: '新加坡小学课程 / PSLE',
    features,
    audience: item.tier === 1 ? '关注热门小学、PSLE 和长期政府学校路径的中国家庭' : '希望进入新加坡政府小学体系、重视英文适应和区域择校的中国家庭',
    angle: `${item.cn}（${item.name}）位于${item.area}，${item.desc} 家长选择这类小学时，重点不是只看名气，而是看孩子英文适应、通勤区域、PSLE 准备和后续中学路径。`,
  };
}

function secondaryToSeo(item) {
  const slug = slugFromItem(item, 'secondary');
  const features = secondaryFeatures(item);
  const copText = typeof item.cop === 'number' ? `参考 COP ${item.cop}` : '特殊或专门路径';
  return {
    type: 'secondary',
    categoryLabel: '政府中学',
    basePath: 'secondary-schools',
    slug,
    nameZh: item.cn,
    nameEn: item.name,
    location: item.area,
    schoolType: `政府中学 / ${item.type || 'Government'} / ${copText}`,
    curriculum: item.programs?.includes('IP') ? 'Integrated Programme / A-Level 路径' : 'O-Level / SEC 中学课程',
    features,
    audience: item.programs?.includes('IP') ? '目标 IP、JC 和公立大学路径的学生家庭' : '准备通过 O-Level、AEIS 或政府中学路径升学的中国学生家庭',
    angle: `${item.cn}（${item.name}）位于${item.area}，${item.desc} 对中国学生来说，选择中学要同时看英文适应、SEC 年级衔接、O-Level/IP 路径、CCA 和后续 JC/Poly 出口。`,
  };
}

function mergeByKey(existing, incoming) {
  const map = new Map(existing.map((item) => [`${item.basePath}/${item.slug}`, item]));
  for (const item of incoming) {
    const key = `${item.basePath}/${item.slug}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

const existing = JSON.parse(read(dataFile));
const primaryItems = extractSchoolsFromIndex('primary-schools/index.html').map(primaryToSeo);
const secondaryItems = extractSchoolsFromIndex('secondary-schools/index.html').map(secondaryToSeo);
const merged = mergeByKey(existing, [...primaryItems, ...secondaryItems]);

fs.writeFileSync(dataFile, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log(`Imported primary=${primaryItems.length}, secondary=${secondaryItems.length}, total=${merged.length}`);
