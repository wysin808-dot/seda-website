import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import { removeSchoolBoilerplate } from '../scripts/remove-school-boilerplate.mjs';
import { softenCta } from '../scripts/soften-page-cta.mjs';
import { enhancePageHtml } from '../scripts/enhance-key-seo-pages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sentence = '如果孩子英文基础稳定、自我管理能力较强';

test('old school migration removes empty advice but keeps school-specific facts', () => {
  const faq = { '@type':'FAQPage',mainEntity:[{name:'学校适合中国学生吗？'},{name:'申请最需要注意什么？'},{name:'费用怎么看？'},{name:'如果进不了学校，还有哪些选择？'}] };
  const html = `<html><head><title>School</title><script type="application/ld+json">${JSON.stringify(faq)}</script></head><body><main><h1>School</h1><article class="content-main"><section class="geo-summary" aria-labelledby="school-quick-answer"><h2>重复摘要</h2></section><p>${sentence}，要规划英文预算。</p><h2>学校独有项目</h2><p>学习项目A，具体课程请参阅<a href="https://example.edu/programme">校方项目资料</a>。</p><section class="faq-section"><details><summary>学校适合中国学生吗？</summary></details><details><summary>申请最需要注意什么？</summary></details><details><summary>费用怎么看？</summary></details><details><summary>如果进不了学校，还有哪些选择？</summary></details></section><section class="related-section"><a href="/aeis/">入学指南</a></section></article></main></body></html>`;
  const fixed = removeSchoolBoilerplate(html);
  assert.doesNotMatch(fixed, new RegExp(sentence));
  assert.doesNotMatch(fixed, /FAQPage|重复摘要/);
  assert.match(fixed, /学校独有项目|example.edu\/programme|href="\/aeis\/"/);
  assert.equal(removeSchoolBoilerplate(fixed), fixed);
});

test('reviewed policy FAQ without old template is untouched', () => {
  const html='<main><h1>真实政策</h1><section class="faq-section"><details><summary>年级如何计算？</summary><p>按当期官方年龄表核对。</p></details></section></main>';
  assert.equal(removeSchoolBoilerplate(html),html);
});

test('soft contact is actionable without pretending to guarantee admission', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'seda-contact-'));
  try {
    fs.writeFileSync(path.join(tmp,'sitemap.xml'),'<urlset><url><loc>https://sgeda.org.cn/example/</loc></url></urlset>');
    fs.mkdirSync(path.join(tmp,'example'));
    const file=path.join(tmp,'example/index.html');
    fs.writeFileSync(file,'<main><section class="contact-section" id="contact"><p>我们确认保底学额</p></section></main>');
    assert.equal(softenCta(tmp).softened,1);
    const result=fs.readFileSync(file,'utf8');
    assert.match(result,/href="\/contact\/"/);
    assert.doesNotMatch(result,/保底|空余学额|还没|纠结/);
    assert.equal(softenCta(tmp).softened,0);
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('Kong Hwa is a sourced custom page, not the old Bedok ranking template', () => {
  const html=read('primary-schools/kong-hwa/index.html');
  const $=load(html);
  const records=JSON.parse(read('content/schools/seo-schools.json'));
  assert.equal(records.find(s=>s.basePath==='primary-schools'&&s.slug==='kong-hwa').customContent,true);
  assert.match(html,/SEDA_CUSTOM_PAGE/);
  assert.match($('main').text(),/350 Guillemard Road/);
  assert.match($('main').text(),/Geylang/);
  assert.match($('main').text(),/1951.*1953/);
  assert.doesNotMatch($('head > title').text(),/Bedok|Tier|怎么样/);
  assert.equal($('a[href="https://www.moe.gov.sg/schoolfinder/schooldetail/kong-hwa-school"]').length>0,true);
  assert.equal($('h1').length,1);
});

test('machine enhancement cannot reinsert keyword-cloud copy or invisible FAQ', () => {
  const src=read('scripts/enhance-key-seo-pages.mjs');
  assert.match(src,/visibleFaqs\.map/);
  assert.doesNotMatch(src,/mainEntity: page\.faq\.map|meta name="ai-summary"/);
});

test('FAQ enhancement derives exact visible copy and does not duplicate a reviewed FAQ', () => {
  const base='<html><head><title>真实页面标题</title><meta name="description" content="此页实际描述"></head><body><main><section class="faq-section"><details><summary>实际问题？</summary><p>页面实际答案。</p></details></section></main></body></html>';
  const out=enhancePageHtml(base,'https://sgeda.org.cn/example/');
  const schemas=load(out)('script[type="application/ld+json"]').toArray().map(el=>JSON.parse(load(el).text()));
  assert.equal(schemas[0].name,'真实页面标题');
  assert.deepEqual(schemas[1].mainEntity,[{'@type':'Question',name:'实际问题？',acceptedAnswer:{'@type':'Answer',text:'页面实际答案。'}}]);
  assert.equal(enhancePageHtml(out,'https://sgeda.org.cn/example/'),out);
  const existing=base.replace('</head>','<script type="application/ld+json">'+JSON.stringify(schemas[1])+'</script></head>');
  const enhanced=load(enhancePageHtml(existing,'https://sgeda.org.cn/example/'));
  assert.equal(enhanced('script[type="application/ld+json"]').toArray().map(el=>JSON.parse(enhanced(el).text())).filter(n=>n['@type']==='FAQPage').length,1);
});

test('migrated representative school body no longer carries four-part generic FAQ', () => {
  for (const route of ['primary-schools/ai-tong','primary-schools/ahmad-ibrahim','secondary-schools/north-vista']) {
    const $=load(read(route+'/index.html'));
    assert.doesNotMatch($('main').text(),/如果孩子英文基础稳定、自我管理能力较强|SEDA 建议家长把预算分成四块看|真正稳妥的选校/);
    assert.equal($('.seo-tags').length,0);
    assert.equal($('h1').length,1);
    assert.ok($('main a[href^="/"], main a[href^="https://sgeda.org.cn/"]').length>0,'same-site navigation remains');
  }
});

test('already migrated school records lose stale schema tags but keep their actual courses', () => {
  const school = {'@type':'School',name:'学校甲',alternateName:'School A',address:'Singapore',about:[{name:'IP直通车'}],knowsAbout:['顶尖学校'],educationalCredentialAwarded:'IBDP'};
  const organization = {'@type':'Organization',name:'SEDA',about:[{name:'组织介绍'}]};
  const web = {'@type':'WebPage',mainEntity:{...school}};
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(school)}</script><script type="application/ld+json">${JSON.stringify(web)}</script><script type="application/ld+json">${JSON.stringify(organization)}</script></head><body><main><article class="content-main"><h2>现有课程记录</h2><ul><li>Government</li><li>适合稳妥择校比较</li><li>顶尖学校</li><li>应用学习项目：机器人设计</li><li>Cambridge IGCSE</li></ul><p data-school-record-note>已有迁移标记</p><section class="related-section"><a href="/aeis/">入学指南</a></section></article></main></body></html>\n`;
  const fixed = removeSchoolBoilerplate(html), $ = load(fixed);
  const nodes = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text()));
  for (const node of [nodes[0],nodes[1],nodes[1].mainEntity]) {
    assert.equal(node.about,undefined);
    assert.equal(node.knowsAbout,undefined);
    assert.equal(node.educationalCredentialAwarded,undefined);
  }
  assert.deepEqual(nodes[2],organization,'do not modify the shared Organization');
  assert.deepEqual($('main ul li').toArray().map(el => $(el).text()),['应用学习项目：机器人设计','Cambridge IGCSE']);
  assert.equal(removeSchoolBoilerplate(fixed),fixed);
  assert.doesNotMatch(fixed,/[ \t]+$/m);
});

test('explicitly hand-edited custom school stays untouched even with migration-like text', () => {
  const html = `<!-- SEDA_CUSTOM_PAGE --><main><article class="content-main"><p>${sentence}</p><p data-school-record-note>手工记录</p></article></main>`;
  assert.equal(removeSchoolBoilerplate(html),html);
});
