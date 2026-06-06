#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.SITE_DIR || process.cwd();
const site = process.env.SITE || 'https://sgeda.org.cn';
const host = new URL(site).host;
const key = process.env.INDEXNOW_KEY || '212f14d5aa77d65865cd1c7bc9719fba';
const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `${site}/${key}.txt`;
const sitemapFile = process.env.SITEMAP_FILE || path.join(root, 'sitemap.xml');
const stateFile = process.env.INDEXNOW_STATE_FILE || path.join(root, '.indexnow-submit-offset');
const logDir = path.join(root, 'data', 'seo');
const submissionFile = process.env.SEO_SUBMISSION_FILE || path.join(logDir, 'submissions.jsonl');
const batchSize = Math.max(1, Math.min(Number(process.env.INDEXNOW_BATCH_SIZE || 20) || 20, 100));

function readSitemapUrls() {
  if (!fs.existsSync(sitemapFile)) return [];
  const raw = fs.readFileSync(sitemapFile, 'utf8');
  return [...raw.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]).filter((url) => url.startsWith(site));
}

function readOffset() {
  if (!fs.existsSync(stateFile)) return 0;
  return Math.max(0, Number(fs.readFileSync(stateFile, 'utf8').trim()) || 0);
}

function writeOffset(offset) {
  fs.writeFileSync(stateFile, `${offset}\n`, 'utf8');
}

function pickBatch(urls, offset) {
  if (!urls.length) return { batch: [], nextOffset: 0 };
  const batch = [];
  for (let i = 0; i < Math.min(batchSize, urls.length); i += 1) {
    batch.push(urls[(offset + i) % urls.length]);
  }
  return { batch, nextOffset: (offset + batch.length) % urls.length };
}

function appendRecord(record) {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(submissionFile, `${JSON.stringify(record)}\n`, 'utf8');
}

async function submitIndexNow(urlList) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, ok: res.ok, text: text.slice(0, 500) };
}

const urls = readSitemapUrls();
const offset = readOffset();
const { batch, nextOffset } = pickBatch(urls, offset);
const startedAt = new Date();

if (!batch.length) {
  const record = {
    date: startedAt.toISOString().slice(0, 10),
    createdAt: startedAt.toISOString(),
    provider: 'indexnow',
    submitted: 0,
    totalUrls: urls.length,
    offset,
    nextOffset,
    status: 'empty',
    httpStatus: 0,
    message: 'No sitemap URLs found',
  };
  appendRecord(record);
  console.log(JSON.stringify(record, null, 2));
  process.exit(1);
}

try {
  const response = await submitIndexNow(batch);
  writeOffset(nextOffset);
  const record = {
    date: startedAt.toISOString().slice(0, 10),
    createdAt: startedAt.toISOString(),
    provider: 'indexnow',
    submitted: batch.length,
    totalUrls: urls.length,
    offset,
    nextOffset,
    status: response.ok ? 'success' : 'error',
    httpStatus: response.status,
    message: response.text,
    urls: batch,
  };
  appendRecord(record);
  console.log(JSON.stringify(record, null, 2));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  const record = {
    date: startedAt.toISOString().slice(0, 10),
    createdAt: startedAt.toISOString(),
    provider: 'indexnow',
    submitted: batch.length,
    totalUrls: urls.length,
    offset,
    nextOffset,
    status: 'error',
    httpStatus: 0,
    message: error.message,
    urls: batch,
  };
  appendRecord(record);
  console.log(JSON.stringify(record, null, 2));
  process.exit(1);
}
