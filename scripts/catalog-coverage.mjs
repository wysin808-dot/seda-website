import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';
import { CATEGORIES, loadCatalog, recordTarget } from './school-catalog.mjs';
import { SITE, inspectPage, localFile } from './seo-pages.mjs';

const TEAMS = { primary: 'AEIS 团队', secondary: 'O-Level / AEIS 团队', international: '国际学校团队', private: '私立大学团队', jc: 'O-Level 团队', poly: 'O-Level 团队', university: '公立大学团队' };

/** Read-only CMS overview: counts records covered by canonical catalog pages,
 * not hundreds of retired per-school URLs. No editorial writes or permissions.
 */
export function catalogCoverageMatrix(root, sitemapUrls) {
  const records = loadCatalog(root);
  const sitemap = new Set(sitemapUrls);
  const groups = CATEGORIES.map(category => {
    const items = records.filter(record => record.category === category.id);
    const url = SITE + category.route;
    const file = localFile(root, url);
    const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const $ = load(html);
    const pageActive = html.includes('<!-- SEDA_SCHOOL_DATABASE -->') && inspectPage(html, url).issues.length === 0;
    const identifiers = new Set($('[data-school-record][id]').toArray().map(el => $(el).attr('id')));
    const checked = items.map(record => ({ record, url: recordTarget(record), exists: pageActive && identifiers.has('school-' + record.id) }));
    const generatedCount = checked.filter(item => item.exists).length;
    const sitemapCount = checked.filter(item => item.exists && sitemap.has(url)).length;
    const missing = checked.filter(item => !item.exists);
    const missingSitemap = checked.filter(item => item.exists && !sitemap.has(url));
    return {
      key: category.id, label: category.label, route: category.route, target: items.length, team: TEAMS[category.id],
      sourceCount: items.length, targetCount: items.length, generatedCount, sitemapCount,
      missingPageCount: missing.length, missingSitemapCount: missingSitemap.length, dataGap: 0,
      coveragePercent: items.length ? Math.round(generatedCount / items.length * 100) : 0,
      nextActions: [...missing.slice(0, 2).map(item => `检查学校库记录 ${item.record.nameZh}（${item.url}）`),
        ...(missingSitemap.length ? [`检查分类地图入口 ${category.route}`] : [])].slice(0, 4),
    };
  });
  const keys = ['sourceCount', 'targetCount', 'generatedCount', 'sitemapCount', 'missingPageCount', 'missingSitemapCount', 'dataGap'];
  const totals = Object.fromEntries(keys.map(key => [key, groups.reduce((sum, group) => sum + group[key], 0)]));
  return { mode: 'catalog', totals, groups };
}
