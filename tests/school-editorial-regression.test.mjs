import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { buildSchoolPages, renderPage, renderInternationalSchoolIndex, renderPrivateSchoolIndex } from '../scripts/build-school-pages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schools = JSON.parse(fs.readFileSync(path.join(root, 'content/schools/seo-schools.json'), 'utf8'));
const normal = schools.filter(school => !school.customContent);
const noTemplate = /适合中国学生吗|给中国家长快速理解|快速答案|快速了解|家庭预算|英文基础|备选学校|费用和家庭预算|学校 SEO 页面|SEO 学校库|结构化数据|seo-tag-cloud|FAQPage|\bCOP\b|\bTier\b|热门|顶尖|性价比/;
const schemas = $ => $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text()));

function assertAnchors($) {
  $('a[href^="#"]').each((_, el) => {
    const id = $(el).attr('href').slice(1);
    assert.ok($('[id]').toArray().some(node => $(node).attr('id') === id), `missing anchor ${id}`);
  });
}

test('all ordinary school records remove duplicated editorial templates and unsupported ranks', () => {
  for (const school of normal) {
    const html = renderPage(school);
    const $ = load(html);
    assert.doesNotMatch(html, noTemplate, school.slug);
    assert.equal($('h1').length, 1, school.slug);
    assert.equal($('h1').text(), school.nameZh);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://sgeda.org.cn/${school.basePath}/${school.slug}/`);
    assert.ok($('article').text().includes(school.location), school.slug + ' location');
    assert.ok($('article').text().includes(school.curriculum), school.slug + ' curriculum');
    assert.equal($('meta[name="keywords"]').length, 0);
    assert.equal($('details').length, 0);
    assert.equal($('a[href="/contact/"]').length > 0, true);
    assert.equal($('img.seda-wechat-qr').attr('src'), '/assets/wechat-amy-seda-guide.jpg');
    assert.equal($('script[src]').attr('src'), '/seda-site.js?v=29');
    assert.equal($('link[rel="stylesheet"]').attr('href'), '/seda-site.css?v=36');
    assertAnchors($);
    $('a[href^="/"]').each((_, el) => {
      const href = $(el).attr('href');
      const file = path.join(root, href, href.endsWith('/') ? 'index.html' : '');
      assert.ok(fs.existsSync(file), `${school.slug}: missing local target ${href}`);
    });
  }
});

test('insufficient records say pending, without claiming to supply admissions or fees', () => {
  const school = schools.find(s => s.slug === 'admiralty' && s.type === 'primary');
  const $ = load(renderPage(school));
  assert.match($('article').text(), /待完善资料记录/);
  assert.match($('meta[name="description"]').attr('content'), /待完善资料记录/);
  assert.match($('#school-materials').parent().text(), /不是完整申请或费用指南/);
  assert.equal($('#school-record').parent().find('.stat-item .num').first().text(), '政府小学');
  assert.equal($('#school-sources').length, 0, 'no manufactured official links');
  assert.equal($('#school-admissions').length, 0, 'no type-level admission filler');
});

test('school-specific higher-education major and admission lists keep their existing value', () => {
  for (const school of schools.filter(s => ['university', 'artsUniversity', 'poly', 'private'].includes(s.type))) {
    const $ = load(renderPage(school));
    for (const item of [...(school.majorAreas || []), ...(school.admissionPaths || [])]) {
      assert.ok($('article').text().includes(item), `${school.slug}: removed useful field ${item}`);
    }
    if (school.officialSource) {
      assert.ok($('#school-sources').parent().text().includes(school.officialSource), school.slug + ' attribution');
    }
    assert.equal($('article').text().includes(school.sedaAdvice), false, school.slug + ' opinion removed');
    assert.match($('#school-materials').parent().text(), /不表示申请资格或录取承诺/);
  }
});

test('JSON-LD describes only visible school information and uses a WebPage mainEntity reference', () => {
  for (const school of normal) {
    const $ = load(renderPage(school));
    const all = schemas($);
    assert.equal(all.length, 3);
    assert.equal(all.some(node => node['@type'] === 'FAQPage'), false);
    const entity = all.find(node => ['School', 'CollegeOrUniversity', 'EducationalOrganization'].includes(node['@type']));
    const page = all.find(node => node['@type'] === 'WebPage');
    assert.equal(page.headline, $('h1').text());
    assert.equal(page.description, $('meta[name="description"]').attr('content'));
    assert.equal(page.description, $('.hero-subtitle').text());
    assert.equal(page.mainEntity['@id'], entity['@id']);
    assert.ok($('body').text().includes(entity.name));
    assert.ok($('body').text().includes(entity.alternateName));
    assert.ok($('body').text().includes(entity.address));
    for (const value of entity.description.split('；')) assert.ok($('body').text().includes(value));
    assert.equal(entity.educationalCredentialAwarded, undefined, 'curriculum is not an awarded credential');
    assert.equal(entity.knowsAbout, undefined, 'no keyword stuffing');
    assert.equal(entity.dateModified, undefined, 'school record is not a freshly verified institution');
    assert.equal(page.dateModified, undefined, 'build date is not a factual verification date');
    if (entity.sameAs) assert.equal($('a[href="' + entity.sameAs + '"]').length, 1);
  }
});

test('external links come only from valid URLs in the record, never synthesized official homepages', () => {
  const school = schools.find(s => s.slug === 'uwcsea');
  const $ = load(renderPage(school));
  assert.equal($('a[href="' + school.sameAs + '"]').length, 1);
  assert.match($('#school-sources').parent().text(), /不代表本页已逐项核实/);
  for (const sameAs of [undefined, '', 'not a URL', '/relative/', 'javascript:alert(1)', 'ftp://school.edu.sg/', 'https://user:secret@school.edu.sg/', 'https://localhost/']) {
    const $invalid = load(renderPage({ ...school, sameAs }));
    assert.equal($('#school-sources', $invalid.root()).length, 0);
    assert.equal(schemas($invalid)[0].sameAs, undefined);
  }
});

test('both school indexes are readable directories rather than keyword clouds or promised guides', () => {
  for (const [type, render, canonical] of [
    ['international', renderInternationalSchoolIndex, 'https://sgeda.org.cn/international-school/schools/'],
    ['private', renderPrivateSchoolIndex, 'https://sgeda.org.cn/private-schools/'],
  ]) {
    const records = schools.filter(s => s.type === type);
    const html = render(records);
    const $ = load(html);
    assert.doesNotMatch(html, noTemplate);
    assert.equal($('h1').length, 1);
    assert.equal($('meta[name="keywords"]').length, 0);
    assert.equal($('link[rel="canonical"]').attr('href'), canonical);
    assert.equal($('.article-card').length, records.length);
    assert.match($('.hero-subtitle').text(), /待完善记录不作为完整申请或费用指南/);
    assertAnchors($);
    const schema = schemas($)[0];
    assert.equal(schema['@type'], 'CollectionPage');
    assert.equal(schema.description, $('.hero-subtitle').text());
    assert.equal(schema.mainEntity['@type'], 'ItemList');
    assert.equal(schema.mainEntity.numberOfItems, records.length);
    const cards = $('.article-card').toArray();
    for (const [index, item] of schema.mainEntity.itemListElement.entries()) {
      assert.equal(item.position, index + 1);
      assert.equal(item.item.name, $(cards[index]).find('h3').text());
      assert.equal(item.item.url, 'https://sgeda.org.cn' + $(cards[index]).attr('href'));
    }
  }
});

test('fixture build never writes over customContent or a marked hand-maintained page; rerender is stable', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-school-editorial-'));
  try {
    const school = schools.find(s => s.type === 'primary');
    const records = [
      { ...school, slug: 'custom', customContent: true },
      { ...school, slug: 'custom-missing', customContent: true },
      { ...school, slug: 'hand-maintained' },
      { ...school, slug: 'generated' },
      schools.find(s => s.type === 'international'),
      schools.find(s => s.type === 'private'),
    ];
    fs.mkdirSync(path.join(tmp, 'content/schools'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'content/schools/seo-schools.json'), JSON.stringify(records));
    const header = '<header class="site-header"><a href="/">SEDA</a></header>';
    const footer = '<footer class="site-footer"><a href="https://seda.org.sg/">组织来源</a></footer>';
    fs.writeFileSync(path.join(tmp, 'index.html'), header + footer);
    for (const [slug, content] of [
      ['custom', '<h1>学校专属资料</h1>'],
      ['hand-maintained', '<!-- SEDA_CUSTOM_PAGE --><h1>手工资料</h1>'],
    ]) {
      const dir = path.join(tmp, school.basePath, slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), content);
    }
    assert.equal(buildSchoolPages(tmp), records.length);
    const custom = path.join(tmp, school.basePath, 'custom/index.html');
    const manual = path.join(tmp, school.basePath, 'hand-maintained/index.html');
    const generated = path.join(tmp, school.basePath, 'generated/index.html');
    assert.equal(fs.readFileSync(custom, 'utf8'), '<h1>学校专属资料</h1>');
    assert.equal(fs.readFileSync(manual, 'utf8'), '<!-- SEDA_CUSTOM_PAGE --><h1>手工资料</h1>');
    assert.equal(fs.existsSync(path.join(tmp, school.basePath, 'custom-missing/index.html')), false);
    const first = fs.readFileSync(generated, 'utf8');
    assert.ok(first.includes(header));
    assert.ok(first.includes(footer));
    buildSchoolPages(tmp);
    assert.equal(fs.readFileSync(generated, 'utf8'), first);
    assert.equal(fs.readFileSync(custom, 'utf8'), '<h1>学校专属资料</h1>');
    assert.equal(fs.readFileSync(manual, 'utf8'), '<!-- SEDA_CUSTOM_PAGE --><h1>手工资料</h1>');
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, 'private-schools/index.html'), 'utf8'), noTemplate);
    assert.doesNotMatch(fs.readFileSync(path.join(tmp, 'international-school/schools/index.html'), 'utf8'), noTemplate);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
