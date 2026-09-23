import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { optionalCount } from './operations-metrics.mjs';

export const platforms = ['ChatGPT', 'Perplexity', '豆包', 'Kimi', 'DeepSeek', 'Bing Copilot'];
export function validateObservation(input) {
  if (!['search', 'citation'].includes(input.type)) throw new Error('type must be search or citation');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || Number.isNaN(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Invalid observation date');
  if (!String(input.evidence || '').trim()) throw new Error('Evidence reference required');
  const base = { type: input.type, date: input.date, evidence: String(input.evidence).slice(0, 500) };
  if (input.type === 'search') {
    if (!['Baidu', 'Bing', 'Google'].includes(input.platform)) throw new Error('Unknown search platform');
    if (!input.periodStart || !input.periodEnd || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) || input.periodStart > input.periodEnd) throw new Error('Explicit reporting period required');
    return { ...base, platform: input.platform, periodStart: input.periodStart, periodEnd: input.periodEnd,
      indexed: optionalCount(input.indexed), impressions: optionalCount(input.impressions), clicks: optionalCount(input.clicks) };
  }
  if (!platforms.includes(input.platform) || !String(input.question || '').trim() || typeof input.webEnabled !== 'boolean' || !String(input.model || '').trim()) throw new Error('Platform, question, model and webEnabled required');
  if (!['cited', 'not_cited', 'unavailable'].includes(input.result)) throw new Error('Invalid citation result');
  const citedUrls = input.citedUrls || [];
  if (!Array.isArray(citedUrls)) throw new Error('citedUrls must be an array');
  for (const value of citedUrls) {
    const url = new URL(value);
    if (url.origin !== 'https://sgeda.org.cn' || url.username || url.password) throw new Error('Record only verified SEDA citation URLs');
  }
  if ((input.result === 'cited') !== (citedUrls.length > 0)) throw new Error('Citation result must match observed URLs');
  return { ...base, platform: input.platform, model: String(input.model).slice(0, 120), webEnabled: input.webEnabled,
    question: String(input.question).slice(0, 500), result: input.result, citedUrls: [...new Set(citedUrls)] };
}

export function observationSummary(file) {
  if (!fs.existsSync(file)) return { status: 'unmeasured', records: 0, search: [], citations: [], invalid: 0 };
  const valid = []; let invalid = 0;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try { valid.push(validateObservation(JSON.parse(line))); } catch { invalid++; }
  }
  const ordered = valid.sort((a, b) => b.date.localeCompare(a.date));
  return { status: valid.length ? 'observed' : 'unmeasured', records: valid.length, invalid,
    search: ordered.filter(row => row.type === 'search').slice(0, 6),
    citations: platforms.map(platform => {
      const rows = ordered.filter(row => row.type === 'citation' && row.platform === platform);
      const tested = rows.filter(row => row.result !== 'unavailable');
      return { platform, attempts: rows.length, tested: tested.length, cited: tested.filter(row => row.result === 'cited').length, latest: rows[0]?.date || null };
    }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = path.join(process.env.SITE_DIR || process.cwd(), 'data/seo/search-observations.jsonl');
  if (process.argv[2] === 'add') {
    if (!process.argv[3]) throw new Error('Usage: npm run seo:observe -- add observation.json');
    const record = validateObservation(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const line = JSON.stringify(record);
    if (!existing.split(/\r?\n/).includes(line)) fs.appendFileSync(file, line + '\n');
  } else if (process.argv[2] && process.argv[2] !== 'summary') throw new Error('Use add or summary');
  console.log(JSON.stringify(observationSummary(file), null, 2));
}
