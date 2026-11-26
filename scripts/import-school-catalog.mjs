#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';
import { CATEGORIES, validateCatalog } from './school-catalog.mjs';

// Run once against the original checkout (or an archived --source-root), never in build.
// No fuzzy names, cross-stage deduplication, fetched schools, inferred websites or SQL.
const JC_SLUGS = ['anderson-serangoon-jc', 'anglo-chinese-jc', 'catholic-jc', 'dunman-high', 'eunoia-jc', 'hwa-chong-institution', 'jurong-pioneer-jc', 'nanyang-jc', 'national-jc', 'raffles-institution', 'river-valley-high', 'st-andrews-jc', 'tampines-meridian-jc', 'temasek-jc', 'victoria-jc', 'yishun-innova-jc'];
const POLY_SLUGS = ['sp', 'np', 'nyp', 'tp', 'rp'];
const UNIVERSITY_SLUGS = ['nus', 'ntu', 'smu', 'sutd', 'sit', 'suss', 'uas'];
// These are the ten real institution pages, not policy/pathway articles.
const PRIVATE_DETAILS = { amity: 'amity-global-institute', curtin: 'curtin-singapore', jcu: 'jcu-singapore', kaplan: 'kaplan', lsbf: 'lsbf-singapore', mdis: 'mdis', psb: 'psb-academy', shrm: 'shrm', sim: 'sim', tmc: 'tmc-academy' };
// The same entity, same school stages and official URL occur in both local directories.
// Preserve the existing seed category/ID rather than inventing a new classification.
const INTERNATIONAL_PRIVATE_ALIASES = ['dimensions-international', 'furen-international', 'insworld-institute', 'st-francis-methodist', 'san-yu-adventist'];
const ARTICLES = new Set(['/international-school/schools/', '/international-school/singapore-international-school-fees/', '/poly/admission/', '/poly/courses/', '/poly/dae/', '/university/admission/', '/university/degrees/', '/university/nus-undergraduate-application-chinese-students/']);
const BAD_SEGMENT = /\bTier\b|\bCOP\b|热门|顶尖|精英|优质|成熟|性价比|最受欢迎|排名|名校|推荐(?!信)|学费|S\$/i;
const plain = value => String(value || '').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];
function clean(value) {
  return unique(plain(value).split(/\s*\/\s*/).filter(part => !BAD_SEGMENT.test(part)).map(part => part.trim())).join(' / ');
}
function cleanList(values) {
  return unique((Array.isArray(values) ? values : []).filter(value => typeof value === 'string').map(value => {
    // Preserve the real EAE pathway, not the accompanying suitability judgment.
    const withoutJudgment = value.includes('适合') ? value.slice(0, value.indexOf('适合')).trim() : value;
    return clean(withoutJudgment);
  }));
}
function official(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || !url.hostname.includes('.') || /(?:^|\.)(?:sgeda\.org\.cn|seda\.org\.sg)$/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}
function normalizedPath(value) {
  const url = new URL(value, 'https://sgeda.org.cn');
  if (url.origin !== 'https://sgeda.org.cn' || url.search || url.hash) throw new Error(`Not a local clean school URL: ${value}`);
  return `/${url.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '')}/`;
}
function arrayFrom(html, context) {
  const match = html.match(/const schools\s*=\s*(\[[\s\S]*?\n\s*\]);/);
  if (!match) throw new Error(`Original school array missing in ${context}; use an unmigrated --source-root`);
  return vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
}
function schoolEntities($) {
  const result = [];
  function visit(object) {
    if (!object || typeof object !== 'object') return;
    if (Array.isArray(object)) return object.forEach(visit);
    if (['School', 'CollegeOrUniversity', 'EducationalOrganization'].includes(object['@type'])) result.push(object);
    if (object['@graph']) visit(object['@graph']);
    if (object.about) visit(object.about);
    if (object.mainEntity) visit(object.mainEntity);
  }
  $('script[type="application/ld+json"]').each((_, node) => {
    try { visit(JSON.parse($(node).text())); } catch { /* Not an entity source. */ }
  });
  return result;
}

/** Compile local sources without writing, calling legacy generators or accessing network. */
export function importSchoolCatalog(sourceRoot = process.cwd()) {
  const records = new Map();
  const evidence = new Map();
  const discarded = [];
  const read = file => {
    const text = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
    if (file.endsWith('.html') && /SEDA_SCHOOL_REDIRECT/.test(text)) throw new Error(`Source already migrated: ${file}; use archived --source-root`);
    return text;
  };
  function cite(id, source) {
    if (!evidence.has(id)) evidence.set(id, new Set());
    evidence.get(id).add(source);
  }
  function add(category, slug, data, source, url) {
    const id = `${category}-${slug}`;
    const next = {
      id, category, nameZh: plain(data.nameZh), nameEn: plain(data.nameEn),
      location: clean(data.location), schoolType: clean(data.schoolType), curriculum: clean(data.curriculum),
      website: official(data.website || data.sameAs), majorAreas: cleanList(data.majorAreas), admissionPaths: cleanList(data.admissionPaths),
      detailUrl: '', legacyUrls: url ? [normalizedPath(url)] : [],
    };
    for (const field of ['schoolType', 'curriculum', 'majorAreas', 'admissionPaths']) {
      if (data[field] && JSON.stringify(data[field]) !== JSON.stringify(next[field])) discarded.push(`${id}.${field}: ${JSON.stringify(data[field])} -> ${JSON.stringify(next[field])}`);
    }
    if (records.has(id)) {
      const existing = records.get(id);
      for (const field of ['nameZh', 'nameEn', 'location', 'schoolType', 'curriculum', 'website']) if (!existing[field]) existing[field] = next[field];
      for (const field of ['majorAreas', 'admissionPaths', 'legacyUrls']) existing[field] = unique([...existing[field], ...next[field]]);
    } else records.set(id, next);
    cite(id, source);
    return records.get(id);
  }
  const seeds = JSON.parse(read('content/schools/seo-schools.json'));
  if (!Array.isArray(seeds) || seeds.length !== 350) throw new Error('Expected the approved original 350-record seed; use an archived source checkout');
  for (const seed of seeds) add(seed.type === 'artsUniversity' ? 'university' : seed.type, seed.slug, seed, 'content/schools/seo-schools.json', `/${seed.basePath}/${seed.slug}/`);
  const coverage = {};
  for (const [category, expected] of [['primary', 179], ['secondary', 146]]) {
    const file = `${category}-schools/index.html`;
    const items = arrayFrom(read(file), file);
    if (items.length !== expected) throw new Error(`${file}: expected ${expected} original records, received ${items.length}`);
    coverage[category] = items.map(item => normalizedPath(item.link));
    for (const item of items) {
      const slug = normalizedPath(item.link).split('/').filter(Boolean).at(-1);
      add(category, slug, {
        nameZh: item.cn, nameEn: item.name, location: item.area,
        schoolType: category === 'primary' ? '政府小学' : ['政府中学', item.type].filter(Boolean).join(' / '),
        curriculum: category === 'primary' ? '新加坡小学课程 / PSLE' : item.programs?.includes('IP') ? 'Integrated Programme / A-Level 路径' : 'O-Level / SEC 中学课程',
      }, file, item.link);
    }
  }

  // Extract only the literal definitions; do NOT import this old writer module.
  const privateSource = read('scripts/import-private-school-data.mjs');
  const literal = privateSource.match(/const schools\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!literal) throw new Error('Private school source definitions missing');
  const privateSeeds = vm.runInNewContext(`const privateSchool = value => value; (${literal[1]})`, {}, { timeout: 1000 });
  for (const seed of privateSeeds) {
    const category = INTERNATIONAL_PRIVATE_ALIASES.includes(seed.slug) ? 'international' : 'private';
    const record = add(category, seed.slug, seed, 'scripts/import-private-school-data.mjs (literal definitions only)', `/private-schools/${seed.slug}/`);
    if (category === 'international') {
      const original = seeds.find(item => item.type === 'international' && item.slug === seed.slug);
      if (!original || original.nameEn !== seed.nameEn || official(original.sameAs) !== official(seed.sameAs)) throw new Error(`Unconfirmed international/private alias: ${seed.slug}`);
      cite(record.id, `Confirmed alias: same nameEn and same existing official URL, same school stages; /private-schools/${seed.slug}/`);
    }
  }

  function enrich(record, file, { retain = false, stage = '' } = {}) {
    const $ = cheerio.load(read(file));
    const main = $('main');
    if (!main.length) throw new Error(`Missing actual school content: ${file}`);
    const entities = schoolEntities($);
    const entity = entities[0] || {};
    if (!record.nameZh) record.nameZh = plain(entity.name || main.find('h1').first().clone().children().remove().end().text().split(/完整指南|完全指南|指南|[（(]/)[0]);
    if (!record.nameEn) {
      const alternate = Array.isArray(entity.alternateName) ? entity.alternateName[0] : entity.alternateName;
      const eyebrow = main.find('.eyebrow').first().text().split('·').map(plain).find(part => /^[A-Za-z]/.test(part) && /School|College|Institution|University/.test(part));
      record.nameEn = plain(alternate || eyebrow);
    }
    if (!record.nameZh || !record.nameEn) throw new Error(`Missing actual school entity names: ${file}`);
    const sidebarAddress = main.find('aside li').toArray().map(node => plain($(node).text())).find(text => text.startsWith('地址：'));
    if (sidebarAddress) record.location = sidebarAddress.slice('地址：'.length).trim();
    else if (!record.location && entity.address) record.location = plain(typeof entity.address === 'string' ? entity.address : [entity.address.streetAddress, entity.address.addressLocality, entity.address.postalCode].filter(Boolean).join(', '));
    const sameAs = Array.isArray(entity.sameAs) ? entity.sameAs : [entity.sameAs];
    if (!record.website) record.website = sameAs.map(official).find(Boolean) || '';
    if (!record.website) {
      // A reference to another school's official contact page is not this school's website.
      const existingAbbreviations = { 'jc-catholic-jc': ['CJC'], 'jc-st-andrews-jc': ['SAJC'] };
      const identityLabels = [record.nameZh, record.nameEn, ...(existingAbbreviations[record.id] || []), ...$('main h1').first().text().matchAll(/[（(]([A-Z]{2,8})[）)]/g)].map(value => typeof value === 'string' ? value : value[1]).filter(Boolean);
      const link = main.find('a[href]').toArray().find(node => {
        const label = plain($(node).text());
        return official($(node).attr('href')) && (/官方完整专业查找器/.test(label) && file.startsWith('private-university/') || /官网/.test(label) && identityLabels.some(name => label.includes(name)));
      });
      if (link) record.website = official($(link).attr('href'));
    }
    // Specific fact-list sections only; never scrape the entire page into a record.
    const areas = main.find('#school-majors li').toArray().map(node => plain($(node).text()));
    const admissions = main.find('#school-admission li').toArray().map(node => plain($(node).text()));
    record.majorAreas = unique([...record.majorAreas, ...cleanList(areas)]);
    record.admissionPaths = unique([...record.admissionPaths, ...cleanList(admissions)]);
    if (stage === 'jc') {
      record.schoolType ||= '初级学院';
      const course = main.find('aside li').toArray().map(node => plain($(node).text())).find(text => text.startsWith('课程：'));
      record.curriculum ||= clean(course ? course.slice('课程：'.length) : main.text().includes('A-Level') ? 'A-Level' : '');
      main.find('table').each((_, table) => {
        const headers = $(table).find('tr').first().text();
        if (/科目类别|主要 H2 科目/.test(headers)) {
          const subjects = $(table).find('tr').slice(1).toArray().map(row => plain($(row).find('td').eq(1).text()));
          record.majorAreas = unique([...record.majorAreas, ...cleanList(subjects)]);
        } else if (/申请方式/.test(headers) && !/学费/.test(headers)) {
          const paths = $(table).find('tr').slice(1).toArray().map(row => plain($(row).find('td').first().text()));
          record.admissionPaths = unique([...record.admissionPaths, ...cleanList(paths)]);
        }
      });
    }
    if (file.startsWith('private-university/')) {
      const fields = main.find('.prc-chip[data-f="fl"]').toArray().map(node => plain($(node).attr('data-v')));
      const paths = main.find('.prc-step > b').toArray().map(node => plain($(node).text()));
      record.majorAreas = unique([...record.majorAreas, ...cleanList(fields)]);
      record.admissionPaths = unique([...record.admissionPaths, ...cleanList(paths)]);
      record.schoolType ||= '私立教育机构';
      record.curriculum ||= unique(main.find('.prc-chip[data-f="lv"]').toArray().map(node => plain($(node).attr('data-v')))).join(' / ');
    }
    const url = normalizedPath(`/${file.replace(/\/index\.html$/, '')}/`);
    record.legacyUrls = unique([...record.legacyUrls, url]);
    if (retain) record.detailUrl = url;
    cite(record.id, file);
    return record;
  }

  for (const slug of JC_SLUGS) {
    const record = records.get(`jc-${slug}`) || add('jc', slug, {}, `jc/${slug}/index.html`, `/jc/${slug}/`);
    enrich(record, `jc/${slug}/index.html`, { retain: true, stage: 'jc' });
  }
  for (const slug of POLY_SLUGS) enrich(records.get(`poly-${slug}`), `poly/${slug}/index.html`, { retain: true });
  for (const slug of UNIVERSITY_SLUGS) enrich(records.get(`university-${slug}`), `university/${slug}/index.html`, { retain: true });
  for (const [detail, slug] of Object.entries(PRIVATE_DETAILS)) {
    const record = records.get(`private-${slug}`) || add('private', slug, {}, `private-university/${detail}/index.html`, `/private-university/${detail}/`);
    enrich(record, `private-university/${detail}/index.html`, { retain: true });
  }
  const kongHwa = enrich(records.get('primary-kong-hwa'), 'primary-schools/kong-hwa/index.html', { retain: true });
  const kongText = read('primary-schools/kong-hwa/index.html');
  const address = kongText.match(/地址为([^<。]+)，位于/);
  if (address) kongHwa.location = plain(address[1]);
  if (kongText.includes('政府辅助小学')) kongHwa.schoolType = '政府辅助小学 / SAP';

  // Already existing canonical redirect and historical short URL named by regression tests.
  const bci = records.get('private-brentvale-college-international');
  const bciAlias = read('private-schools/bci/index.html');
  if (!bciAlias.includes('/private-schools/brentvale-college-international/')) throw new Error('BCI short alias not confirmed by existing canonical');
  bci.nameZh = 'BCI';
  bci.legacyUrls = unique([...bci.legacyUrls, '/private-schools/bci/']);
  cite(bci.id, 'private-schools/bci/index.html (existing canonical alias)');
  // Confirmed in the original tests/baidu-coverage-regression.test.mjs before
  // migration and explicitly required by the approved task. Freeze that evidence:
  // future regression-test edits must not silently erase this historical alias.
  const psb = records.get('private-psb-academy');
  psb.legacyUrls = unique([...psb.legacyUrls, '/private-schools/psb/']);
  cite(psb.id, 'tests/baidu-coverage-regression.test.mjs (historical /private-schools/psb/)');

  // Audit every existing ordinary school file, not only URLs already present in seeds.
  const owned = () => new Map([...records.values()].flatMap(record => record.legacyUrls.map(url => [url, record])));
  for (const base of ['primary-schools', 'secondary-schools', 'international-school', 'private-schools', 'jc', 'poly', 'university', 'private-university']) {
    for (const directory of fs.readdirSync(path.join(sourceRoot, base), { withFileTypes: true }).filter(item => item.isDirectory())) {
      const file = `${base}/${directory.name}/index.html`;
      const url = `/${base}/${directory.name}/`;
      if (ARTICLES.has(url) || !fs.existsSync(path.join(sourceRoot, file))) continue;
      const record = owned().get(url);
      if (!record) throw new Error(`Unclassified existing school/detail URL: ${url}; explicitly confirm its entity before importing`);
      // Approved pages were read above. Other templates can contribute basic existing metadata,
      // but cannot acquire detailUrl from customContent, prose length or arbitrary headings.
      if (!record.detailUrl || record.detailUrl !== url) enrich(record, file);
    }
  }
  // Exact identity only, within a category. Near words and different stages never merge.
  const names = new Map();
  for (const record of records.values()) {
    const key = `${record.category}:${record.nameEn.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()}`;
    if (names.has(key) && names.get(key) !== record.id) throw new Error(`Duplicate exact same-stage school name requires confirmed alias: ${record.id} / ${names.get(key)}`);
    names.set(key, record.id);
  }
  const result = [...records.values()].sort((a, b) => CATEGORIES.findIndex(item => item.id === a.category) - CATEGORIES.findIndex(item => item.id === b.category) || a.id.localeCompare(b.id, 'en'));
  for (const record of result) record.legacyUrls.sort();
  const retainedDetails = result.filter(record => record.detailUrl).map(record => record.detailUrl).sort();
  const retained = new Set(retainedDetails);
  const policy = {
    version: 1, categories: CATEGORIES.map(category => ({ ...category })), retainedDetails,
    redirects: result.flatMap(record => record.legacyUrls.filter(url => !retained.has(url)).map(from => ({ from, to: record.detailUrl || `${CATEGORIES.find(category => category.id === record.category).route}#school-${record.id}`, recordId: record.id }))).sort((a, b) => a.from.localeCompare(b.from, 'en')),
  };
  validateCatalog(result, policy);
  return { records: result, policy, coverage, evidence: Object.fromEntries([...evidence].map(([id, files]) => [id, [...files]])), discarded };
}

function main() {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const root = path.resolve(value('--root') || process.cwd());
  const sourceRoot = path.resolve(value('--source-root') || root);
  const catalog = path.join(root, 'content/schools/database.json');
  const policyFile = path.join(root, 'content/schools/database-policy.json');
  if (args.includes('--write') && (fs.existsSync(catalog) || fs.existsSync(policyFile))) throw new Error('One-time import refuses to overwrite the independent maintained catalog; export to a separate --root from an archived --source-root instead');
  const { records, policy } = importSchoolCatalog(sourceRoot);
  if (args.includes('--write')) {
    fs.mkdirSync(path.dirname(catalog), { recursive: true });
    fs.writeFileSync(catalog, `${JSON.stringify(records, null, 2)}\n`);
    fs.writeFileSync(policyFile, `${JSON.stringify(policy, null, 2)}\n`);
  }
  console.log(JSON.stringify({ write: args.includes('--write'), records: records.length, counts: Object.fromEntries(CATEGORIES.map(category => [category.id, records.filter(record => record.category === category.id).length])), retained: policy.retainedDetails.length, redirects: policy.redirects.length }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
