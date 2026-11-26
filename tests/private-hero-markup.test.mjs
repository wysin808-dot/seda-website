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
// Reviewed against HEAD 13206df on 2026-11-26. Only the eight affected
// summaries' <b>/</b> formatting markers are removed; all prose is unchanged.
// PSB and SIM were already plain text and require no page edits.
const summaries = {
  amity: '印度 Amity 教育集团旗下的新加坡校区，学生来自 45+ 国家；合作英国 UEA、伦敦大学、Teesside、Northampton 授予学位，商科、人工智能 / 数据科学、物流与酒店旅游见长。EduTrust 4 年认证。',
  curtin: '澳洲科廷大学（QS 世界 #183）的新加坡直属校区，颁发与本部完全一致的学位；商科、会计金融、传媒与信息科技见长，学制紧凑、可加速完成。',
  jcu: '澳洲詹姆斯库克大学（QS 世界 #440）的新加坡直属校区，颁发与本部完全相同的学位；一年 3 学期、最快约 2 年读完本科。海洋与环境科学、心理学、商科、IT、酒店旅游见长。',
  kaplan: '全球教育集团 Kaplan 旗下，新加坡专业最广、开课最灵活的私立学府之一；合作 12 所英、澳、爱名校（UCD、Royal Holloway、Northumbria、Murdoch、Essex、Portsmouth 等）授予学位，商科、会计金融、IT、网络安全、传媒、酒店等齐全。EduTrust 认证。',
  lsbf: '伦敦商业金融学院新加坡校区，专注商科、会计金融与酒店管理；合作英国格林威治大学等授予学位，课程偏实务与职业资格（如 ACCA）衔接。EduTrust 4 年认证。',
  mdis: '新加坡历史最悠久的非营利私立学府（1956 年创办），自有校园与宿舍；合作英国 Teesside、Sunderland、Edinburgh Napier、Roehampton、Bangor 及美国中俄克拉荷马大学，专业覆盖最广——商科、工程、生科、时尚、传媒、心理、护理、IT。EduTrust 认证。',
  psb: '新加坡领先私立学府，与英、澳、新西兰 8 所大学合作，提供从语言、文凭到本科、硕士的完整升学路径；3 大市中心校区，EduTrust 认证，工程与生命科学是特色。',
  shrm: '酒店与旅游管理专精的私立学院（2007 年创办，前身 SHRM 酒店与度假村管理学院）；合作英国 Wrexham、Cumbria 授予学位，课程偏实操与行业实训。EduTrust 4 年认证。',
  sim: '新加坡规模最大、历史最久的私立学府之一（1964 年创办），与英、澳、美、加、欧 12 所大学合作，提供 140+ 专业；伦敦大学（LSE 学术引领）、悉尼大学、伯明翰、华威等名校学位，校园与学生生活成熟。',
  tmc: '新加坡最早的私立学府之一（1981 年创办），专业面广——商科、IT、心理学、酒店旅游、传媒等；现主要合作英国 Anglia Ruskin 授予学位。EduTrust 4 年认证。',
};
const slugs = Object.keys(summaries);
const tagOrEncodedDelimiter = /[<>]|&(?:lt|gt|#0*(?:60|62)|#x0*(?:3c|3e));/i;
function collegeSchemas($) {
  const colleges = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    const types = [].concat(value['@type'] || []);
    if (types.includes('CollegeOrUniversity')) colleges.push(value);
    for (const child of Object.values(value)) walk(child);
  }
  $('script[type="application/ld+json"]').each((_, el) => walk(JSON.parse($(el).text())));
  return colleges;
}
function assertSummary(html, slug, expected = summaries[slug]) {
  const $ = load(html);
  const hero = $('main p.sig');
  assert.equal(hero.length, 1, `${slug}: exactly one hero summary`);
  assert.equal(hero.children().length, 0, `${slug}: no markup elements in summary`);
  assert.ok(hero.contents().toArray().every(node => node.type === 'text'), `${slug}: text nodes only`);
  assert.doesNotMatch(hero.text(), tagOrEncodedDelimiter, `${slug}: no visible literal/encoded tags`);
  assert.equal(hero.text(), expected, `${slug}: original summary prose unchanged`);
  const colleges = collegeSchemas($);
  assert.equal(colleges.length, 1, `${slug}: exactly one CollegeOrUniversity`);
  assert.equal(typeof colleges[0].description, 'string', `${slug}: description is plain text`);
  assert.doesNotMatch(colleges[0].description, tagOrEncodedDelimiter, `${slug}: no tags in structured description`);
  assert.equal(colleges[0].description, expected, `${slug}: structured description matches visible summary`);
  return $;
}

for (const slug of slugs) {
  test(`${slug}: hero and CollegeOrUniversity description are unchanged plain text`, () => {
    assertSummary(read(`private-university/${slug}/index.html`), slug);
  });
}

test('summary gate rejects real, escaped and double-escaped markup in body or JSON-LD', () => {
  const fixture = (body, description) => '<main><p class="sig">' + body + '</p></main>' +
    '<script type="application/ld+json">' + JSON.stringify({
      '@graph': [{ '@type': ['CollegeOrUniversity'], description }],
    }) + '</script>';
  assert.doesNotThrow(() => assertSummary(fixture('学校介绍', '学校介绍'), 'fixture', '学校介绍'));
  for (const bad of [
    '<b>学校介绍</b>', '&lt;b&gt;学校介绍&lt;/b&gt;',
    '&amp;lt;b&amp;gt;学校介绍&amp;lt;/b&amp;gt;',
    '&#60;b&#62;学校介绍&#60;/b&#62;',
    '学校介绍<img src="x">', '学校介绍<!-- hidden markup -->',
  ]) {
    assert.throws(() => assertSummary(fixture(bad, '学校介绍'), 'fixture', '学校介绍'));
    assert.throws(() => assertSummary(fixture('学校介绍', bad), 'fixture', '学校介绍'));
  }
});

test('copied generator keeps ten plain-text sig sources, isolated render and normal escaping', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seda-private-hero-'));
  const files = ['scripts/build-private-rich.py', ...slugs.map(slug => `private-university/${slug}/index.html`)];
  const before = files.map(file => hash(read(file)));
  try {
    // ROOT derives from __file__: copy only the generator and synthetic chrome.
    // Do not call main(), build_aggregate(), the CLI or any real-ROOT build.
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.mkdirSync(path.join(tmp, 'poly/sp'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/build-private-rich.py'), path.join(tmp, 'scripts/build-private-rich.py'));
    fs.writeFileSync(path.join(tmp, 'poly/sp/index.html'), '<header class="site-header"></header><footer class="site-footer"></footer>');
    const code = String.raw`
import builtins, io, json, os, pathlib, runpy, shutil, sys
sandbox = pathlib.Path(sys.argv[1]).resolve()
real_open, real_io_open = builtins.open, io.open
def guard(file, mode):
    if any(flag in mode for flag in "wax+"):
        raise AssertionError("generator attempted write during safe import/render")
    if isinstance(file, (str, bytes, os.PathLike)):
        resolved = pathlib.Path(file).resolve()
        if not resolved.is_relative_to(sandbox):
            raise AssertionError("generator attempted read outside isolated ROOT: " + str(resolved))
def read_only_open(file, mode="r", *args, **kwargs):
    guard(file, mode)
    return real_open(file, mode, *args, **kwargs)
def read_only_io_open(file, mode="r", *args, **kwargs):
    guard(file, mode)
    return real_io_open(file, mode, *args, **kwargs)
def no_mutation(*args, **kwargs):
    raise AssertionError("generator attempted filesystem mutation")
builtins.open, io.open = read_only_open, read_only_io_open
for operation in ("makedirs", "mkdir", "remove", "unlink", "rename", "replace", "rmdir"):
    setattr(os, operation, no_mutation)
shutil.rmtree = no_mutation
module = runpy.run_path(str(sandbox / "scripts/build-private-rich.py"), run_name="private_hero_test")
assert pathlib.Path(module["ROOT"]).resolve() == sandbox
assert callable(module["main"])
assert not (sandbox / "private-university").exists()
source = {slug: data["sig"] for slug, data in module["RICH"].items()}
rendered = {slug: module["build"](slug) for slug in module["RICH"]}
probe = "A & B <em title=\"safe\">'quoted'</em>"
escaped = {}
for slug, data in module["RICH"].items():
    original = data["sig"]
    try:
        data["sig"] = probe
        escaped[slug] = module["build"](slug)
    finally:
        data["sig"] = original
assert not (sandbox / "private-university").exists()
print(json.dumps({"source": source, "rendered": rendered, "escaped": escaped}, ensure_ascii=False))
`;
    const result = spawnSync('python3', ['-B', '-c', code, tmp], {
      cwd: tmp, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    const { source, rendered, escaped } = JSON.parse(result.stdout);
    for (const value of [source, rendered, escaped]) {
      assert.deepEqual(Object.keys(value).sort(), [...slugs].sort(), 'all ten schools covered');
    }
    for (const slug of slugs) {
      assert.doesNotMatch(source[slug], tagOrEncodedDelimiter, `${slug}: sig maintenance source has no tags`);
      assert.equal(source[slug], summaries[slug], `${slug}: source prose unchanged`);
      assertSummary(rendered[slug], slug);
      const hero = load(escaped[slug])('main p.sig');
      assert.equal(hero.children().length, 0, `${slug}: escaping probe creates no HTML elements`);
      assert.equal(hero.text(), 'A & B <em title="safe">\'quoted\'</em>', `${slug}: special characters preserved as text`);
      assert.ok(escaped[slug].includes('<p class="sig">A &amp; B &lt;em title=&quot;safe&quot;&gt;&#x27;quoted&#x27;&lt;/em&gt;</p>'),
        `${slug}: ampersands, tag delimiters and both quote types remain escaped`);
    }
    assert.equal(fs.existsSync(path.join(tmp, 'private-university')), false, 'isolated render writes no pages');
  } finally {
    try {
      assert.deepEqual(files.map(file => hash(read(file))), before, 'isolated rendering must not alter repository files');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});
