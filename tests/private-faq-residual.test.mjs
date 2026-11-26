import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { load } from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
// Reviewed 2026-11-26 before deleting the unsupported FAQ. Partner counts include
// each school's own diploma card; direct JCU/Curtin pages have no partner cards.
// Fingerprints protect every original programme, partner and pathway node, not
// just totals. Update only with an independently approved school-data change.
const baseline = {
  amity: [18, 5, '1061562c31abb6b0b20d03329058d180a1056a22bb3fe183c1a14ba93df54784', 'be280f493f46704744a482941bcd7f36a8c0c87c0f7d37a974c961b9b66bc54d', '5eacdc2496959ee5375ba31a4673aca177c97002637696dab624ac5b6ed78132'],
  curtin: [20, 0, '3c0cf5cb75763243a168fd5a0234c3daf2b7ca0bf9113332477e839665927663', '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', '8d1ebfe881710324258730955fb08bc8bf4a8d0c43c07ca0d13e8f84a199dabb'],
  jcu: [21, 0, '00aa4a7bc1559024825e4761ec2b8566331bcd364611fdb9527c33f322312785', '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', '87f63deff557e1ac5211b2df2e1b9a2c6e318268cd1df3f9fb15f05afbd94992'],
  kaplan: [27, 7, 'b16aa3a2e3427dcb91c4d7311ce2258f34d1a445bc55a399cabff95cd053d689', '490ac4b6a90fbcbb0c977f9bf4f1e95a2b1b73b48bcbe93a57370dd9143a017b', 'c212916dd9b31abf4227abfd07377a80f5cf9e1328b2f5ebb569828eb968e272'],
  lsbf: [12, 5, '7382c17b84b59caf771e39783512fc90b51a3bcced1f1bab2c239198fb6fa8b8', 'a9b101ac78d0cf3847853ba16aa25ea511f0377af5adb0960043750f63549fb0', 'efddc0358d23cf2bf5e159b5a4a73a8d53e36093645244d22174df945acb1d92'],
  mdis: [21, 7, 'c2c20d529ef2d51083a27859479f2ebf18164b41bcd041bef64ed5dbb0d0a7ca', '0512e576db94825d5bbc480fb4c208eda4ad9f9a16fea9b94913492f28b39f48', '3f8f6953bbbfa93ec1b183d83a23fcf63d102f4dcb9d6bf619592387c9846523'],
  psb: [73, 9, '5e117f0ad60227dfa630ceebf5e406799f0d5ec5a5d970f64df1383deac52420', 'daf1ec8daf0facc86d3858589e4864da66a47a35247ce07c6266bfa8bbec0c84', '0a4cf700f8f61bf0ecef83eb3aac21e8ff69ed389c6ac101fcef8bb783f50bcf'],
  shrm: [10, 3, '35d978a901720846e6125e35bce17651ca3f91978709180d8da803a5dd3d822f', '544418545138d9b40b988a2a401c073faa512242ae43bc188359c123fe969d4e', '110f5d5d76f3c395f1cdb6e11f841f46e9753cc79ade585f8505ec173f3b27a8'],
  sim: [55, 13, '6fc857e385243e921439aca18dcb6151b44559a63b9992c3bc555a74d9001922', 'af5b012cfce9a375af055f7f29070ef0d916236ce24826eef8ad000650713981', '0b3984da28dad2a39d63aca88f8a9665bd5fc158c5b640d0de1dfe3e4df11918'],
  tmc: [16, 3, '1c1afb6698474c3ff91299f7f644cb0027ccd8cfc2426ac9e3b6e106275b54a3', '36d74da215bf545aaacb30311d9fe398acfeb8611f4cce8312570abc5fa9eca7', '90d44fda7b03ac5a6d236be9240ddebc1ceef28ee3353d6c3920b0ff09e8bbff'],
};
const slugs = Object.keys(baseline);
const unsupported = /中国学生没有高考能申请吗|接受高中毕业证\s*\+\s*成绩单|英语雅思约\s*5\.5|本科段\s*6\.0\s*[–-]\s*6\.5|学费通常可按学期分期|中留服|全球认可|高中即可申请|无需高考|中国学生典型路线|学历达标可跳过前段/;
const schemas = $ => $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text()));
const nodes = ($, selector) => $(selector).toArray().map(el => $.html(el));

function containsFaqSchema(value) {
  if (!value || typeof value !== 'object') return false;
  const type = value['@type'];
  if (type === 'FAQPage' || (Array.isArray(type) && type.includes('FAQPage'))) return true;
  return Object.values(value).some(containsFaqSchema);
}

function assertNoResidual(html, slug) {
  const $ = load(html);
  const route = new URL(`https://sgeda.org.cn/private-university/${slug}/`);
  const main = $('main').clone();
  main.find('script,style').remove();
  assert.doesNotMatch(main.text(), unsupported, `${slug}: visible generic promise`);
  assert.doesNotMatch($('meta[name="description"]').attr('content') || '', unsupported, `${slug}: metadata promise`);
  assert.equal($('main .prc-faq, main .faq-section, main [id*="faq" i], main details').length, 0, `${slug}: FAQ or empty FAQ shell`);
  assert.equal($('main h2,main h3').toArray().some(el => /FAQ|常见问题/i.test($(el).text())), false, `${slug}: empty FAQ heading`);
  const all = schemas($);
  assert.equal(all.some(containsFaqSchema), false, `${slug}: stale/nested FAQPage`);
  assert.doesNotMatch(JSON.stringify(all), unsupported, `${slug}: structured promise`);
  assert.doesNotMatch(html, /prc-faq/, `${slug}: unused FAQ CSS/markup`);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const url = new URL(href, route);
    if (url.origin !== route.origin || url.pathname !== route.pathname || !url.hash) return;
    const id = decodeURIComponent(url.hash.slice(1));
    assert.doesNotMatch(id + ' ' + $(el).text(), /faq|常见问题/i, `${slug}: stale FAQ navigation`);
    assert.ok($('[id]').toArray().some(target => $(target).attr('id') === id), `${slug}: missing anchor ${id}`);
  });
  return $;
}

function assertCurtinIdentity($) {
  const content = $('main').clone();
  content.find('.prc-rel,script,style').remove();
  // Related-school navigation may legitimately link to JCU; identity prose may not.
  assert.doesNotMatch(content.text(), /詹姆斯库克|James\s*Cook|\bJCU\b/i);
  assert.doesNotMatch(JSON.stringify(schemas($)), /詹姆斯库克|James\s*Cook|\bJCU\b/i);
  assert.match($('.ov').first().text(), /Curtin.*澳洲科廷大学.*直属校区/);
}

for (const slug of slugs) {
  test(`${slug}: no shared FAQ/promises; original programmes, partners and pathways remain`, () => {
    const $ = assertNoResidual(read(`private-university/${slug}/index.html`), slug);
    const [programmes, partners, programmeHash, partnerHash, pathwayHash] = baseline[slug];
    assert.equal($('.prc-prog').length, programmes);
    assert.equal($('.prc-pc').length, partners);
    assert.equal(hash(JSON.stringify(nodes($, '.prc-prog'))), programmeHash, 'all original programme rows retained');
    assert.equal(hash(JSON.stringify(nodes($, '.prc-pc'))), partnerHash, 'all original partner cards retained');
    assert.equal(hash(JSON.stringify(nodes($, '.prc-path'))), pathwayHash, 'school-specific admission/pathway list retained');
    const types = ['CollegeOrUniversity', 'ItemList', 'BreadcrumbList', 'Organization'];
    if (slug === 'sim') types.push('WebPage');
    assert.deepEqual(schemas($).map(node => node['@type']).sort(), types.sort(), 'existing non-FAQ schemas retained');
    const directory = schemas($).find(node => node['@type'] === 'ItemList');
    assert.equal(directory.numberOfItems, programmes);
    assert.equal(directory.itemListElement.length, programmes);
    assert.ok(schemas($).some(node => node['@type'] === 'CollegeOrUniversity'));
    assert.ok(schemas($).some(node => node['@type'] === 'BreadcrumbList'));
    assert.equal($('h1').length, 1);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://sgeda.org.cn/private-university/${slug}/`);
    assert.ok($('.prc-facts th').toArray().some(el => $(el).text() === '开学时间'));
    assert.ok($('a[href="/contact/"]').length > 0);
    assert.ok($('header a[href="/guides/parents-faq/"]').length > 0, 'shared parents FAQ guide remains');
    if (slug === 'curtin') assertCurtinIdentity($);
  });
}

test('residual gate rejects hidden schemas, empty FAQ shells and dead FAQ navigation', () => {
  const base = '<html><head></head><body><main><h1>School</h1></main></body></html>';
  for (const extra of [
    '<section class="prc-faq"><h2>常见问题</h2></section>',
    '<section><h2>FAQ</h2></section>',
    '<aside><a href="#faq">常见问题</a></aside>',
    '<a href="/private-university/amity/#faq">问答</a>',
    '<a href="#missing">课程</a>',
    '<p>接受高中毕业证 + 成绩单；英语雅思约 5.5（本科段 6.0–6.5）</p>',
    '<script type="application/ld+json">{"@graph":[{"@type":["WebPage","FAQPage"],"mainEntity":[]}]}</script>',
    '<script type="application/ld+json">{"@type":"WebPage","description":"全球认可、中留服认证稳"}</script>',
  ]) {
    assert.throws(() => assertNoResidual(base.replace('</main>', extra + '</main>'), 'amity'));
  }
  assert.doesNotThrow(() => assertNoResidual(base.replace('</main>', '<a href="/guides/parents-faq/">家长 FAQ</a></main>'), 'amity'));
});

test('old Python generator safely imports and renders ten isolated pages without restoring the FAQ', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-private-faq-'));
  // Only a copied script and synthetic shared chrome are accessible as its ROOT.
  // Never run the CLI or build_aggregate() against the real repository.
  const files = ['scripts/build-private-rich.py', ...slugs.map(slug => `private-university/${slug}/index.html`)];
  const before = files.map(file => hash(read(file)));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.mkdirSync(path.join(tmp, 'poly/sp'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/build-private-rich.py'), path.join(tmp, 'scripts/build-private-rich.py'));
    fs.writeFileSync(path.join(tmp, 'poly/sp/index.html'), '<header class="site-header"></header><footer class="site-footer"></footer>');
    const code = String.raw`
import builtins, json, os, pathlib, runpy, shutil, sys
sandbox = pathlib.Path(sys.argv[1]).resolve()
real_open = builtins.open

def read_only_open(file, mode="r", *args, **kwargs):
    if any(flag in mode for flag in "wax+"):
        raise AssertionError("generator attempted write during safe import/render")
    if isinstance(file, (str, bytes, os.PathLike)):
        resolved = pathlib.Path(file).resolve()
        if not resolved.is_relative_to(sandbox):
            raise AssertionError("generator attempted read outside isolated ROOT: " + str(resolved))
    return real_open(file, mode, *args, **kwargs)

def no_mutation(*args, **kwargs):
    raise AssertionError("generator attempted filesystem mutation")

builtins.open = read_only_open
os.makedirs = no_mutation
shutil.rmtree = no_mutation
module = runpy.run_path(str(sandbox / "scripts/build-private-rich.py"), run_name="private_rich_test")
assert pathlib.Path(module["ROOT"]).resolve() == sandbox
assert callable(module["main"])
assert not (sandbox / "private-university").exists()
result = {slug: module["build"](slug) for slug in module["RICH"]}
assert not (sandbox / "private-university").exists()
print(json.dumps(result, ensure_ascii=False))
`;
    const result = spawnSync('python3', ['-B', '-c', code, tmp], {
      cwd: tmp, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    const rendered = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(rendered).sort(), [...slugs].sort());
    for (const slug of slugs) {
      const $ = assertNoResidual(rendered[slug], slug);
      const [programmes, partners, programmeHash, partnerHash, pathwayHash] = baseline[slug];
      assert.equal($('.prc-prog').length, programmes, slug);
      assert.equal($('.prc-pc').length, partners, slug);
      assert.equal(hash(JSON.stringify(nodes($, '.prc-prog'))), programmeHash, slug + ': generator programmes unchanged');
      assert.equal(hash(JSON.stringify(nodes($, '.prc-pc'))), partnerHash, slug + ': generator partners unchanged');
      assert.equal(hash(JSON.stringify(nodes($, '.prc-path'))), pathwayHash, slug + ': generator pathways unchanged');
      assert.equal(schemas($).find(node => node['@type'] === 'ItemList').numberOfItems, programmes);
      if (slug === 'curtin') assertCurtinIdentity($);
    }
    assert.equal(fs.existsSync(path.join(tmp, 'private-university')), false);
  } finally {
    assert.deepEqual(files.map(file => hash(read(file))), before, 'safe import/render must not alter repository files');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
