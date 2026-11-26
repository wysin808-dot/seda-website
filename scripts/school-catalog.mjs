import fs from 'node:fs';
import path from 'node:path';

/** Public routes are fixed by plan.md; changing them requires an explicit migration. */
export const CATEGORIES = Object.freeze([
  { id: 'primary', label: '政府小学', route: '/primary-schools/' },
  { id: 'secondary', label: '政府中学', route: '/secondary-schools/' },
  { id: 'international', label: '国际学校', route: '/international-school/schools/' },
  { id: 'private', label: '私立学校', route: '/private-schools/' },
  { id: 'jc', label: '初级学院', route: '/school-database/jc/' },
  { id: 'poly', label: '理工学院', route: '/school-database/poly/' },
  { id: 'university', label: '大学', route: '/school-database/university/' },
].map(Object.freeze));

const FIELDS = ['id', 'category', 'nameZh', 'nameEn', 'location', 'schoolType', 'curriculum', 'website', 'majorAreas', 'admissionPaths', 'detailUrl', 'legacyUrls'];
const STRING_FIELDS = ['id', 'category', 'nameZh', 'nameEn', 'location', 'schoolType', 'curriculum', 'website', 'detailUrl'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCHOOL_PATH = /^\/(?:primary-schools|secondary-schools|international-school|private-schools|private-university|jc|poly|university)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const NON_SCHOOL_PATHS = new Set([
  '/international-school/schools/', '/international-school/singapore-international-school-fees/',
  '/poly/admission/', '/poly/courses/', '/poly/dae/', '/university/admission/', '/university/degrees/',
  '/university/nus-undergraduate-application-chinese-students/',
]);
const FORBIDDEN_COPY = /\b(?:Tier|COP)\b|排名|顶尖|精英|推荐(?!信)|适合|学费|S\$|QS\s*(?:#|世界)/i;

function check(condition, message) {
  if (!condition) throw new Error(`School catalog: ${message}`);
}
function exactKeys(value, keys, context) {
  check(value && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  check(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `${context} must contain exactly ${keys.join(', ')}`);
}
function schoolPath(value, context) {
  check(typeof value === 'string' && SCHOOL_PATH.test(value) && !NON_SCHOOL_PATHS.has(value), `${context} is not a normalized ordinary school URL: ${value}`);
}
function validatePolicyShape(policy) {
  exactKeys(policy, ['version', 'categories', 'retainedDetails', 'redirects'], 'policy');
  check(policy.version === 1, 'unsupported policy version');
  check(Array.isArray(policy.categories) && policy.categories.length === 7, 'policy must contain all seven categories');
  const ids = new Set();
  for (const category of policy.categories) {
    exactKeys(category, ['id', 'label', 'route'], 'category');
    const expected = CATEGORIES.find(item => item.id === category.id);
    check(expected && category.label === expected.label && category.route === expected.route, `invalid category contract: ${category.id}`);
    check(!ids.has(category.id), `duplicate category: ${category.id}`);
    ids.add(category.id);
  }
  check(Array.isArray(policy.retainedDetails), 'retainedDetails must be an array');
  const retained = new Set();
  for (const url of policy.retainedDetails) {
    schoolPath(url, 'retainedDetails');
    check(!retained.has(url), `duplicate retained URL: ${url}`);
    retained.add(url);
  }
  check(Array.isArray(policy.redirects), 'redirects must be an array');
  const redirects = new Map();
  for (const redirect of policy.redirects) {
    exactKeys(redirect, ['from', 'to', 'recordId'], 'redirect');
    schoolPath(redirect.from, 'redirect.from');
    check(typeof redirect.to === 'string' && typeof redirect.recordId === 'string', 'redirect target and recordId must be strings');
    check(!redirects.has(redirect.from), `duplicate/conflicting redirect: ${redirect.from}`);
    check(!retained.has(redirect.from), `retained URL cannot redirect: ${redirect.from}`);
    check(redirect.from !== redirect.to && redirect.from !== redirect.to.split('#')[0], `self mapping: ${redirect.from}`);
    redirects.set(redirect.from, redirect);
  }
  for (const redirect of redirects.values()) {
    check(!redirects.has(redirect.to.split('#')[0]), `redirect chain/cycle: ${redirect.from} -> ${redirect.to}`);
  }
  return { retained, redirects };
}

/** Always target the searchable same-page record, even when a detail article exists. */
export function recordTarget(record, categories = CATEGORIES) {
  const category = categories.find(item => item.id === record.category);
  check(category, `unknown category: ${record.category}`);
  check(typeof record.id === 'string' && record.id.startsWith(`${record.category}-`) && SLUG.test(record.id.slice(record.category.length + 1)), `invalid record id: ${record.id}`);
  return `${category.route}#school-${record.id}`;
}

/** Used when migrating an old school URL or offering the optional full article. */
export function schoolTarget(record) {
  return record.detailUrl || recordTarget(record);
}

/** Validation is entirely JSON-based: never reread migrated HTML or the legacy seed. */
export function validateCatalog(records, policy) {
  check(Array.isArray(records), 'database must be an array');
  const { retained, redirects } = validatePolicyShape(policy);
  const byId = new Map();
  const owners = new Map();
  const names = new Map();
  const detailOwners = new Map();
  const counts = Object.fromEntries(CATEGORIES.map(category => [category.id, 0]));
  for (const record of records) {
    exactKeys(record, FIELDS, 'record');
    for (const key of STRING_FIELDS) {
      check(typeof record[key] === 'string' && record[key] === record[key].trim(), `${record.id}.${key} must be a trimmed string`);
      check(!/[<>\u0000-\u001f]/.test(record[key]), `${record.id}.${key} contains markup/control characters`);
    }
    check(Object.hasOwn(counts, record.category), `invalid category: ${record.category}`);
    check(record.id.startsWith(`${record.category}-`) && SLUG.test(record.id.slice(record.category.length + 1)), `invalid stable ASCII id: ${record.id}`);
    check(!byId.has(record.id), `duplicate id: ${record.id}`);
    check(record.nameZh.length > 0 && record.nameEn.length > 0, `${record.id} must have existing school names`);
    const nameKey = `${record.category}:${record.nameEn.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ')}`;
    check(!names.has(nameKey), `duplicate same-category entity name: ${record.nameEn}`);
    names.set(nameKey, record.id);
    recordTarget(record);
    if (record.website) {
      let official;
      try { official = new URL(record.website); } catch { throw new Error(`School catalog: invalid website: ${record.id}`); }
      check(['https:', 'http:'].includes(official.protocol) && official.hostname.includes('.') && !official.username && !official.password && !official.port && !official.hash && !official.search && !/^(?:localhost|127\.|0\.|192\.168\.|10\.)/.test(official.hostname), `invalid public official website: ${record.id}`);
      check(!/(?:^|\.)(?:sgeda\.org\.cn|seda\.org\.sg)$/.test(official.hostname), `${record.id} website must not be the SEDA article URL`);
    }
    for (const key of ['majorAreas', 'admissionPaths', 'legacyUrls']) {
      check(Array.isArray(record[key]), `${record.id}.${key} must be an array`);
      const seen = new Set();
      for (const value of record[key]) {
        check(typeof value === 'string' && value.length > 0 && value === value.trim() && !/[<>\u0000-\u001f]/.test(value), `${record.id}.${key} must contain nonempty plain strings`);
        check(!seen.has(value), `${record.id}.${key} contains duplicates`);
        seen.add(value);
      }
    }
    for (const value of [record.schoolType, record.curriculum, ...record.majorAreas, ...record.admissionPaths]) {
      check(!FORBIDDEN_COPY.test(value), `${record.id} contains unsupported promotional/fee/ranking copy: ${value}`);
    }
    for (const url of record.legacyUrls) {
      schoolPath(url, `${record.id}.legacyUrls`);
      const bases = { primary: ['primary-schools'], secondary: ['secondary-schools'], international: ['international-school', 'private-schools'], private: ['private-schools', 'private-university'], jc: ['jc'], poly: ['poly'], university: ['university'] };
      check(bases[record.category].includes(url.split('/')[1]), `legacy URL crosses a school stage/category: ${record.id} -> ${url}`);
      check(!owners.has(url), `legacy URL has multiple owners: ${url}`);
      owners.set(url, record.id);
    }
    if (record.detailUrl) {
      schoolPath(record.detailUrl, `${record.id}.detailUrl`);
      check(retained.has(record.detailUrl), `detailUrl is not explicitly retained: ${record.detailUrl}`);
      check(record.legacyUrls.includes(record.detailUrl), `retained detail missing from legacyUrls: ${record.id}`);
      check(!detailOwners.has(record.detailUrl), `detail URL has multiple owners: ${record.detailUrl}`);
      detailOwners.set(record.detailUrl, record.id);
    }
    byId.set(record.id, record);
    counts[record.category]++;
  }
  const minimums = { primary: 179, secondary: 146, international: 1, private: 1, jc: 16, poly: 5, university: 7 };
  for (const [category, minimum] of Object.entries(minimums)) {
    check(counts[category] >= minimum, `category ${category} lost existing coverage: ${counts[category]} < ${minimum}`);
  }
  for (const url of retained) check(detailOwners.has(url), `retained URL lacks a detail record: ${url}`);
  for (const redirect of redirects.values()) {
    const record = byId.get(redirect.recordId);
    check(record, `redirect references unknown record: ${redirect.recordId}`);
    check(owners.get(redirect.from) === record.id, `redirect.from not owned by its record: ${redirect.from}`);
    check(redirect.to === schoolTarget(record), `incorrect migration target: ${redirect.from} -> ${redirect.to}`);
    if (record.detailUrl) check(retained.has(redirect.to), `redirect detail target not retained: ${redirect.to}`);
  }
  for (const [url, recordId] of owners) {
    if (retained.has(url)) {
      check(detailOwners.get(url) === recordId, `retained URL owner mismatch: ${url}`);
    } else {
      check(redirects.has(url), `legacy URL is missing an exact redirect: ${url}`);
    }
  }
  return true;
}

export function loadCatalogPolicy(root = process.cwd()) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'content/schools/database-policy.json'), 'utf8'));
  validatePolicyShape(policy);
  return policy;
}

export function loadCatalog(root = process.cwd()) {
  const records = JSON.parse(fs.readFileSync(path.join(root, 'content/schools/database.json'), 'utf8'));
  validateCatalog(records, loadCatalogPolicy(root));
  return records;
}
