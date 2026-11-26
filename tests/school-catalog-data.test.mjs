import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CATEGORIES, loadCatalog, loadCatalogPolicy, recordTarget, schoolTarget, validateCatalog } from '../scripts/school-catalog.mjs';

const root = path.resolve(import.meta.dirname, '..');
const records = loadCatalog(root);
const policy = loadCatalogPolicy(root);
const byId = new Map(records.map(record => [record.id, record]));
const clone = value => JSON.parse(JSON.stringify(value));
const seed = JSON.parse(fs.readFileSync(path.join(root, 'content/schools/seo-schools.json'), 'utf8'));
const fields = ['id', 'category', 'nameZh', 'nameEn', 'location', 'schoolType', 'curriculum', 'website', 'majorAreas', 'admissionPaths', 'detailUrl', 'legacyUrls'];
const addedSecondary = ['admiralty', 'ahmad-ibrahim', 'ang-mo-kio', 'bedok-green', 'bendemeer', 'bukit-view', 'canberra', 'chua-chu-kang', 'east-spring', 'edgefield', 'evergreen', 'fuhua', 'gan-eng-seng', 'greenridge', 'hougang', 'junyuan', 'jurong-west', 'kuo-chuan-presbyterian', 'marsiling', 'meridian', 'naval-base', 'new-town', 'ngee-ann', 'north-vista', 'northland', 'orchid-park', 'pasir-ris', 'pei-hwa', 'queenstown', 'regent', 'riverside', 'sembawang', 'seng-kang', 'serangoon', 'spectra', 'tampines', 'temasek-junior-college', 'unity', 'westwood', 'whitley', 'woodgrove', 'woodlands', 'woodlands-ring', 'yio-chu-kang', 'yishun', 'yuhua', 'yuying', 'zhenghua', 'zhonghua'];
const jcSlugs = ['anderson-serangoon-jc', 'anglo-chinese-jc', 'catholic-jc', 'dunman-high', 'eunoia-jc', 'hwa-chong-institution', 'jurong-pioneer-jc', 'nanyang-jc', 'national-jc', 'raffles-institution', 'river-valley-high', 'st-andrews-jc', 'tampines-meridian-jc', 'temasek-jc', 'victoria-jc', 'yishun-innova-jc'];
const expectedRetained = [
  '/primary-schools/kong-hwa/',
  ...jcSlugs.map(slug => `/jc/${slug}/`),
  ...['sp', 'np', 'nyp', 'tp', 'rp'].map(slug => `/poly/${slug}/`),
  ...['nus', 'ntu', 'smu', 'sutd', 'sit', 'suss', 'uas'].map(slug => `/university/${slug}/`),
  ...['amity', 'curtin', 'jcu', 'kaplan', 'lsbf', 'mdis', 'psb', 'shrm', 'sim', 'tmc'].map(slug => `/private-university/${slug}/`),
].sort();
const noMarketing = /\b(?:Tier|COP)\b|排名|顶尖|精英|推荐(?!信)|适合|学费|S\$|QS\s*(?:#|世界)/i;

test('415 independent records cover all seven fixed categories and routes', () => {
  assert.equal(validateCatalog(records, policy), true);
  assert.equal(records.length, 415);
  assert.deepEqual(Object.fromEntries(CATEGORIES.map(category => [category.id, records.filter(record => record.category === category.id).length])), { primary: 179, secondary: 146, international: 48, private: 14, jc: 16, poly: 5, university: 7 });
  assert.deepEqual(policy.categories, CATEGORIES);
  assert.deepEqual(CATEGORIES.map(category => category.route), ['/primary-schools/', '/secondary-schools/', '/international-school/schools/', '/private-schools/', '/school-database/jc/', '/school-database/poly/', '/school-database/university/']);
});

test('every original seed URL and all 49 additional secondary directory URLs have records', () => {
  assert.equal(seed.length, 350);
  for (const original of seed) {
    const category = original.type === 'artsUniversity' ? 'university' : original.type;
    const record = byId.get(`${category}-${original.slug}`);
    assert.ok(record, `missing original entity ${original.type}-${original.slug}`);
    assert.ok(record.legacyUrls.includes(`/${original.basePath}/${original.slug}/`));
    assert.equal(record.nameEn, original.nameEn);
  }
  assert.equal(seed.filter(record => record.type === 'primary').length, 179);
  assert.equal(seed.filter(record => record.type === 'secondary').length, 97);
  assert.equal(addedSecondary.length, 49);
  for (const slug of addedSecondary) assert.ok(byId.get(`secondary-${slug}`).legacyUrls.includes(`/secondary-schools/${slug}/`));
});

test('records have exactly the approved fields and no template facts or promotion', () => {
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), [...fields].sort());
    assert.match(record.id, new RegExp(`^${record.category}-[a-z0-9]+(?:-[a-z0-9]+)*$`));
    for (const value of [record.schoolType, record.curriculum, ...record.majorAreas, ...record.admissionPaths]) assert.doesNotMatch(value, noMarketing, `${record.id}: ${value}`);
    for (const key of ['features', 'angle', 'geoAnswer', 'audience', 'customContent', 'tier', 'cop', 'fee', 'ranking', 'lastVerified']) assert.equal(Object.hasOwn(record, key), false);
  }
  // An authentic inherited school name is not a ranking/suitability claim.
  assert.equal(byId.get('primary-frontier').nameEn, 'Frontier Primary School');
  assert.ok(byId.get('university-nus').admissionPaths.some(value => value.includes('推荐信')));
});

test('original real major/admission lists survive with only suitability wording removed', () => {
  for (const original of seed.filter(record => record.majorAreas || record.admissionPaths)) {
    const category = original.type === 'artsUniversity' ? 'university' : original.type;
    const record = byId.get(`${category}-${original.slug}`);
    for (const value of original.majorAreas || []) assert.ok(record.majorAreas.includes(value), `${record.id} missing major ${value}`);
    for (const value of original.admissionPaths || []) {
      const plain = (value.includes('适合') ? value.slice(0, value.indexOf('适合')) : value).trim().replace(/\s*\/\s*/g, ' / ');
      assert.ok(record.admissionPaths.includes(plain), `${record.id} missing admission ${plain}`);
    }
  }
  for (const slug of ['dimensions-international', 'furen-international', 'insworld-institute', 'st-francis-methodist', 'san-yu-adventist']) {
    const record = byId.get(`international-${slug}`);
    assert.ok(record.majorAreas.length && record.admissionPaths.length);
    assert.deepEqual(record.legacyUrls, [`/international-school/${slug}/`, `/private-schools/${slug}/`]);
    assert.equal(byId.has(`private-${slug}`), false, 'same entity must not be duplicated by directory');
  }
  assert.ok(byId.get('private-shrm').majorAreas.includes('酒店旅游'));
  assert.ok(byId.get('private-shrm').admissionPaths.includes('本科学位（Top-up）'));
});

test('the explicit 39 actual school details are retained, including every JC/Poly/university entity', () => {
  assert.deepEqual(policy.retainedDetails, expectedRetained);
  assert.deepEqual(records.filter(record => record.detailUrl).map(record => record.detailUrl).sort(), expectedRetained);
  for (const url of expectedRetained) assert.equal(records.filter(record => record.detailUrl === url).length, 1);
  for (const slug of ['hwa-chong-institution', 'raffles-institution', 'dunman-high', 'river-valley-high']) {
    const secondary = byId.get(`secondary-${slug}`);
    const jc = byId.get(`jc-${slug}`);
    assert.ok(secondary && jc);
    assert.equal(secondary.detailUrl, '');
    assert.equal(jc.detailUrl, `/jc/${slug}/`);
    assert.notEqual(recordTarget(secondary), recordTarget(jc));
    assert.ok(!secondary.legacyUrls.some(url => url.startsWith('/jc/')));
  }
  assert.notEqual(byId.get('primary-chij').nameEn, byId.get('primary-chij-primary').nameEn);
  assert.equal(byId.get('private-brentvale-college-international').detailUrl, '', 'customContent cannot promote a short template');
});

test('PSB/BCI short aliases and private school aliases each migrate directly to the correct entity', () => {
  const psb = byId.get('private-psb-academy');
  assert.deepEqual(psb.legacyUrls, ['/private-schools/psb-academy/', '/private-schools/psb/', '/private-university/psb/']);
  const bci = byId.get('private-brentvale-college-international');
  assert.equal(bci.nameZh, 'BCI');
  assert.deepEqual(bci.legacyUrls, ['/private-schools/bci/', '/private-schools/brentvale-college-international/']);
  for (const [id, detail] of [['private-sim', 'sim'], ['private-kaplan', 'kaplan'], ['private-mdis', 'mdis'], ['private-psb-academy', 'psb'], ['private-jcu-singapore', 'jcu'], ['private-curtin-singapore', 'curtin'], ['private-lsbf-singapore', 'lsbf'], ['private-amity-global-institute', 'amity'], ['private-tmc-academy', 'tmc']]) assert.equal(byId.get(id).detailUrl, `/private-university/${detail}/`);
  for (const from of bci.legacyUrls) assert.equal(policy.redirects.find(redirect => redirect.from === from).to, recordTarget(bci));
  for (const from of ['/private-schools/psb/', '/private-schools/psb-academy/']) assert.equal(policy.redirects.find(redirect => redirect.from === from).to, '/private-university/psb/');
});

test('record fragments are always available even when optional full details exist', () => {
  const nus = byId.get('university-nus');
  assert.equal(recordTarget(nus), '/school-database/university/#school-university-nus');
  assert.equal(schoolTarget(nus), '/university/nus/');
  const plain = byId.get('primary-admiralty');
  assert.equal(recordTarget(plain), '/primary-schools/#school-primary-admiralty');
  assert.equal(schoolTarget(plain), recordTarget(plain));
  assert.equal(recordTarget(nus, [{ id: 'university', route: '/test/' }]), '/test/#school-university-nus');
});

test('431 legacy URLs form exactly 39 retained details and 392 single-hop redirects, never articles/directories', () => {
  const retained = new Set(policy.retainedDetails);
  const redirects = new Map(policy.redirects.map(redirect => [redirect.from, redirect]));
  assert.equal(policy.redirects.length, 392);
  assert.equal(redirects.size, 392);
  const oldUrls = records.flatMap(record => record.legacyUrls);
  assert.equal(oldUrls.length, 431);
  assert.equal(new Set(oldUrls).size, 431);
  for (const record of records) for (const url of record.legacyUrls) {
    assert.match(url, /^\/[a-z-]+\/[a-z0-9-]+\/$/);
    assert.doesNotMatch(url, /[?#]|index\.html/);
    if (retained.has(url)) assert.equal(redirects.has(url), false);
    else {
      assert.equal(redirects.get(url).recordId, record.id);
      assert.equal(redirects.get(url).to, schoolTarget(record));
    }
  }
  for (const redirect of policy.redirects) {
    assert.notEqual(redirect.to, '/');
    assert.notEqual(redirect.from, redirect.to.split('#')[0]);
    assert.equal(redirects.has(redirect.to.split('#')[0]), false);
  }
  for (const excluded of ['/jc/', '/poly/', '/university/', '/private-university/', '/international-school/', '/international-school/schools/', '/international-school/singapore-international-school-fees/', '/poly/admission/', '/poly/courses/', '/poly/dae/', '/university/admission/', '/university/degrees/', '/university/nus-undergraduate-application-chinese-students/']) assert.equal(redirects.has(excluded), false);
});

test('existing official URLs remain legal, missing URLs stay empty, and CJC/SAJC do not borrow each other websites', () => {
  for (const record of records) if (record.website) assert.ok(['http:', 'https:'].includes(new URL(record.website).protocol));
  for (const original of seed.filter(record => record.sameAs)) {
    const category = original.type === 'artsUniversity' ? 'university' : original.type;
    assert.equal(byId.get(`${category}-${original.slug}`).website, new URL(original.sameAs).href);
  }
  assert.equal(byId.get('private-brentvale-college-international').website, '');
  assert.equal(byId.get('primary-admiralty').website, '');
  assert.equal(new URL(byId.get('jc-st-andrews-jc').website).hostname, 'www.standrewsjc.moe.edu.sg');
  assert.equal(new URL(byId.get('jc-catholic-jc').website).hostname, 'www.cjc.moe.edu.sg');
  assert.equal(byId.get('primary-kong-hwa').website, 'https://www.konghwa.moe.edu.sg/');
  assert.equal(byId.get('primary-kong-hwa').location, '350 Guillemard Road, Singapore 399772');
});

test('runtime loading needs only the two maintained JSON files, not old pages or seed', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-catalog-model-'));
  try {
    fs.mkdirSync(path.join(temporary, 'content/schools'), { recursive: true });
    fs.writeFileSync(path.join(temporary, 'content/schools/database.json'), JSON.stringify(records));
    fs.writeFileSync(path.join(temporary, 'content/schools/database-policy.json'), JSON.stringify(policy));
    assert.deepEqual(loadCatalog(temporary), records);
    assert.deepEqual(loadCatalogPolicy(temporary), policy);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('importing either model or one-time importer performs no writes', () => {
  const model = pathToFileURL(path.join(root, 'scripts/school-catalog.mjs')).href;
  const importer = pathToFileURL(path.join(root, 'scripts/import-school-catalog.mjs')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import fs from 'node:fs'; fs.writeFileSync = () => { throw new Error('forbidden import write'); }; fs.mkdirSync = () => { throw new Error('forbidden import mkdir'); }; await import(${JSON.stringify(model)}); await import(${JSON.stringify(importer)});`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('one-time writer refuses maintained catalog overwrite or migrated sources', () => {
  const before = fs.readFileSync(path.join(root, 'content/schools/database.json'), 'utf8');
  const result = spawnSync(process.execPath, ['scripts/import-school-catalog.mjs', '--write'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refuses to overwrite|already migrated|Original school array missing/);
  assert.equal(fs.readFileSync(path.join(root, 'content/schools/database.json'), 'utf8'), before);
});

const invalidRecordCases = [
  ['non-ASCII id', record => { record.id = 'primary-中文'; }],
  ['bad slug', record => { record.id = 'primary-Invalid__'; }],
  ['wrong prefix', record => { record.id = 'secondary-admiralty'; }],
  ['missing field', record => { delete record.location; }],
  ['extra template field', record => { record.geoAnswer = '旧推荐'; }],
  ['not string array', record => { record.majorAreas = '工程'; }],
  ['empty array item', record => { record.majorAreas = ['']; }],
  ['duplicate array item', record => { record.majorAreas = ['工程', '工程']; }],
  ['invalid website', record => { record.website = 'javascript:alert(1)'; }],
  ['credentials website', record => { record.website = 'https://user:pass@school.edu.sg/'; }],
  ['internal website', record => { record.website = 'http://127.0.0.1/'; }],
  ['SEDA article website', record => { record.website = 'https://sgeda.org.cn/primary-schools/admiralty/'; }],
  ['marketing field content', record => { record.schoolType = 'Tier 1 顶尖小学'; }],
  ['HTML content', record => { record.location = '<script>bad</script>'; }],
  ['non-slash old URL', record => { record.legacyUrls = ['/primary-schools/admiralty']; }],
  ['query old URL', record => { record.legacyUrls = ['/primary-schools/admiralty/?q=1']; }],
  ['fragment old URL', record => { record.legacyUrls = ['/primary-schools/admiralty/#old']; }],
  ['directory old URL', record => { record.legacyUrls = ['/primary-schools/']; }],
  ['cross-stage old URL', record => { record.legacyUrls = ['/jc/admiralty/']; }],
  ['unapproved detail', record => { record.detailUrl = '/primary-schools/admiralty/'; }],
];
for (const [label, mutate] of invalidRecordCases) test(`validator rejects ${label}`, () => {
  const changed = clone(records);
  mutate(changed.find(record => record.id === 'primary-admiralty'));
  assert.throws(() => validateCatalog(changed, policy), /School catalog:/);
});

test('validator rejects duplicate identities, URL owners and lost category coverage', () => {
  const changed = clone(records);
  changed[1].nameEn = changed[0].nameEn;
  assert.throws(() => validateCatalog(changed, policy), /duplicate same-category entity/);
  const duplicate = clone(records);
  duplicate[1].legacyUrls.push(duplicate[0].legacyUrls[0]);
  assert.throws(() => validateCatalog(duplicate, policy), /multiple owners/);
  assert.throws(() => validateCatalog(records.filter(record => record.id !== 'primary-admiralty'), policy), /lost existing coverage/);
});

const invalidPolicyCases = [
  ['missing category', changed => { changed.categories.pop(); }],
  ['wrong category route', changed => { changed.categories[0].route = '/'; }],
  ['duplicate category', changed => { changed.categories[1] = clone(changed.categories[0]); }],
  ['duplicate redirect', changed => { changed.redirects.push(clone(changed.redirects[0])); }],
  ['retained redirect collision', changed => { changed.retainedDetails.push(changed.redirects[0].from); }],
  ['missing old alias redirect', changed => { changed.redirects.pop(); }],
  ['wrong record target', changed => { changed.redirects[0].to = '/school-database/#school-wrong'; }],
  ['home fallback', changed => { changed.redirects[0].to = '/'; }],
  ['unknown record', changed => { changed.redirects[0].recordId = 'primary-missing'; }],
  ['self mapping', changed => { changed.redirects[0].to = changed.redirects[0].from; }],
  ['self fragment', changed => { changed.redirects[0].to = `${changed.redirects[0].from}#school-any`; }],
  ['redirect cycle', changed => { const [a, b] = changed.redirects; a.to = b.from; b.to = a.from; }],
  ['redirect chain', changed => { changed.redirects[0].to = changed.redirects[1].from; }],
  ['policy article redirect', changed => { changed.redirects[0].from = '/poly/admission/'; }],
];
for (const [label, mutate] of invalidPolicyCases) test(`validator rejects ${label}`, () => {
  const changed = clone(policy);
  mutate(changed);
  assert.throws(() => validateCatalog(records, changed), /School catalog:/);
});
