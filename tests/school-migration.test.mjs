import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CATEGORY_ROUTES, REDIRECT_MARKER, prepareSchoolMigration, sourceVariants,
  renderSchoolNginxRules, migrateSchoolPages, validateSchoolMigrationTargets,
  rewriteSchoolUrl, rewriteSchoolReferenceText, rewriteSchoolReferences,
} from '../scripts/migrate-school-pages.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installer = path.join(repository, 'scripts/install-school-redirects.sh');
const gitGuard = '\n    # BEGIN SEDA_GIT_ACCESS_GUARD\n    if ($uri ~ "^/+[.]git(?:/|$)") {\n        return 404;\n    }\n    # END SEDA_GIT_ACCESS_GUARD\n';
function inputs() {
  const catalog = [
    { id: 'alpha-primary', nameZh: '甲小学', nameEn: 'Alpha Primary', category: 'primary', detailUrl: '', legacyUrls: ['/primary-schools/alpha/', '/primary-schools/alpha-alias/'] },
    { id: 'alpha-jc', nameZh: '甲初院', category: 'jc', detailUrl: '/singapore-education/jc/alpha/', legacyUrls: ['/secondary-schools/alpha-jc-alias/'] },
    { id: 'beta-secondary', nameZh: '乙中学', category: 'secondary', detailUrl: '', legacyUrls: ['/secondary-schools/beta/'] },
  ];
  const policy = {
    version: 1, categories: Object.entries(CATEGORY_ROUTES).map(([id, route]) => ({ id, label: id, route })),
    retainedDetails: ['/singapore-education/jc/alpha/'],
    redirects: [
      { from: '/primary-schools/alpha/', to: '/primary-schools/#school-alpha-primary', recordId: 'alpha-primary' },
      { from: '/primary-schools/alpha-alias/', to: '/primary-schools/#school-alpha-primary', recordId: 'alpha-primary' },
      { from: '/secondary-schools/alpha-jc-alias/', to: '/singapore-education/jc/alpha/', recordId: 'alpha-jc' },
      { from: '/secondary-schools/beta/', to: '/secondary-schools/#school-beta-secondary', recordId: 'beta-secondary' },
    ],
  };
  return { catalog, policy };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seda-migration-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, relative, value) {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
  return file;
}
async function targetPages(root) {
  await put(root, 'primary-schools/index.html', '<html><main id="school-alpha-primary">甲小学</main></html>');
  await put(root, 'secondary-schools/index.html', '<html><main id="school-beta-secondary">乙中学</main></html>');
  await put(root, 'singapore-education/jc/alpha/index.html', '<html><main>实质甲初院详情</main></html>');
}

test('import has no file side effects or catalog dependency', async t => {
  const root = await fixture(t);
  const module = pathToFileURL(path.join(repository, 'scripts/migrate-school-pages.mjs')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(module)})`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readdir(root), []);
});

test('exact ASCII rules cover every slash/no-slash/index variant and same-school alias', () => {
  const prepared = prepareSchoolMigration(...[inputs().policy, inputs().catalog]);
  const rules = renderSchoolNginxRules(prepared);
  assert.match(rules, /^[\x00-\x7f]+$/);
  for (const entry of prepared.redirects) {
    for (const variant of sourceVariants(entry.from)) {
      assert.ok(rules.includes(`location = ${variant} { return 301 "https://sgeda.org.cn${entry.to}"; }`));
    }
  }
  assert.equal((rules.match(/location = /g) || []).length, 12);
  assert.ok(!rules.includes('location ^~'));
  assert.ok(!rules.includes('return 301 https://'));
  assert.ok(!rules.includes('location = /singapore-education/jc/alpha/ '));
  assert.ok(!rules.includes('location = /primary-schools/ '));
});

test('compatibility page is small, noindex, named, marked and category-canonical without fragment', async t => {
  const root = await fixture(t);
  const old = await put(root, 'primary-schools/alpha/index.html', 'old content');
  const retained = await put(root, 'singapore-education/jc/alpha/index.html', 'retained substantial content');
  const article = await put(root, 'primary-schools/admission-guide/index.html', '<article>政策正文</article>');
  await migrateSchoolPages(root, { ...inputs(), validateTargets: false });
  const html = await fs.readFile(old, 'utf8');
  assert.ok(html.includes(REDIRECT_MARKER));
  assert.match(html, /name="robots" content="noindex,follow"/);
  assert.match(html, /rel="canonical" href="https:\/\/sgeda\.org\.cn\/primary-schools\/"/);
  assert.match(html, /href="https:\/\/sgeda\.org\.cn\/primary-schools\/#school-alpha-primary"/);
  assert.match(html, /甲小学/);
  assert.match(html, /meta refresh 不是 HTTP 301/);
  assert.ok(!/analytics|<header|<footer|<script/.test(html));
  assert.ok(html.length < 1800);
  assert.equal(await fs.readFile(retained, 'utf8'), 'retained substantial content');
  assert.equal(await fs.readFile(article, 'utf8'), '<article>政策正文</article>');
});

test('late target validation checks real files and hash IDs; initial generation and import do not require UI', async t => {
  const root = await fixture(t);
  await migrateSchoolPages(root, { ...inputs(), rewriteReferences: false, validateTargets: false });
  await assert.rejects(validateSchoolMigrationTargets(root, inputs()), /Missing school target/);
  await targetPages(root);
  assert.deepEqual(await validateSchoolMigrationTargets(root, inputs()), { targetsValidated: 4 });
  await put(root, 'primary-schools/index.html', '<html><p id="wrong-school">wrong</p></html>');
  await assert.rejects(migrateSchoolPages(root, { ...inputs(), validateTargets: true }), /Missing school target fragment/);
  await targetPages(root);
  const result = await migrateSchoolPages(root, { ...inputs(), validateOnly: true });
  assert.equal(result.targetsValidated, 4);
  assert.deepEqual(result.filesChanged, []);
});

test('validation runs before any write when targets are missing and rejects compatibility destinations', async t => {
  const root = await fixture(t);
  await assert.rejects(migrateSchoolPages(root, { ...inputs(), validateTargets: true }), /Missing school target/);
  assert.deepEqual(await fs.readdir(root), []);
  await targetPages(root);
  await put(root, 'primary-schools/index.html', `${REDIRECT_MARKER}<p id="school-alpha-primary">not active</p>`);
  await assert.rejects(validateSchoolMigrationTargets(root, inputs()), /not active/);
});

test('migration is byte-idempotent and dry run does not write', async t => {
  const root = await fixture(t);
  const dry = await migrateSchoolPages(root, { ...inputs(), dryRun: true, validateTargets: false });
  assert.equal(dry.filesChanged.length, 5);
  assert.deepEqual(await fs.readdir(root), []);
  await targetPages(root);
  await migrateSchoolPages(root, { ...inputs(), validateTargets: true });
  const again = await migrateSchoolPages(root, { ...inputs(), validateTargets: true });
  assert.deepEqual(again.filesChanged, []);
  assert.deepEqual(again.referencesChanged, []);
});

test('query/hash handling preserves query, prefers record hash, keeps retained-detail sections and canonical stays fragment-free', () => {
  const { policy, catalog } = inputs();
  const exact = prepareSchoolMigration(policy, catalog).exact;
  assert.equal(rewriteSchoolUrl('/primary-schools/alpha?src=old#fees', exact), '/primary-schools/?src=old#school-alpha-primary');
  assert.equal(rewriteSchoolUrl('https://www.sgeda.org.cn/primary-schools/alpha/index.html?x=1#school', exact), 'https://sgeda.org.cn/primary-schools/?x=1#school-alpha-primary');
  assert.equal(rewriteSchoolUrl('/secondary-schools/alpha-jc-alias/#fees', exact), '/singapore-education/jc/alpha/#fees');
  assert.equal(rewriteSchoolUrl('/primary-schools/alpha/?x=1#school', exact, { canonical: true }), '/primary-schools/');
  for (const untouched of ['https://other.org/primary-schools/alpha/', 'https://sgeda.org.cn.evil.org/primary-schools/alpha/', '//sgeda.org.cn/primary-schools/alpha/', '/primary-schools/alpha-other/', '/primary-schools/#school-alpha-primary']) assert.equal(rewriteSchoolUrl(untouched, exact), untouched);
});

test('targeted HTML/onclick/JS and JSON-LD rewriting does not alter body formatting, names or unrelated URLs', () => {
  const exact = prepareSchoolMigration(inputs().policy, inputs().catalog).exact;
  const before = `<main  class='original'>文本 /primary-schools/alpha/\n<a href="/primary-schools/alpha/?a=1&amp;b=2#old">甲</a><div onclick="location.href='/primary-schools/alpha/'"></div>\n<link rel="canonical" href="https://sgeda.org.cn/primary-schools/alpha/#school">\n<script>const url = '/primary-schools/alpha/'; const other='/primary-schools/alpha-other/';</script>\n<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"item":{"@id":"https://sgeda.org.cn/primary-schools/alpha/#school","url":"https://sgeda.org.cn/primary-schools/alpha/","name":"/primary-schools/alpha/"}}]}</script></main>`;
  const result = rewriteSchoolReferenceText(before, exact);
  assert.ok(result.startsWith(`<main  class='original'>文本 /primary-schools/alpha/`));
  assert.ok(result.includes('/primary-schools/?a=1&amp;b=2#school-alpha-primary'));
  assert.ok(result.includes(`location.href='/primary-schools/#school-alpha-primary'`));
  assert.ok(result.includes('rel="canonical" href="https://sgeda.org.cn/primary-schools/"'));
  assert.ok(result.includes('"@id":"https://sgeda.org.cn/primary-schools/#school-alpha-primary"'));
  assert.ok(result.includes('"name":"/primary-schools/alpha/"'));
  assert.ok(result.includes("const other='/primary-schools/alpha-other/'"));
  assert.equal(rewriteSchoolReferenceText(result, exact), result);
  assert.equal(rewriteSchoolReferenceText("const url='/primary-schools/alpha/';", exact, { javascript: true }), "const url='/primary-schools/#school-alpha-primary';");
  assert.equal(rewriteSchoolReferenceText('const record={name:"/primary-schools/alpha/",url:"/primary-schools/alpha/"};', exact, { javascript: true }), 'const record={name:"/primary-schools/alpha/",url:"/primary-schools/#school-alpha-primary"};');
  const untouchedClick = '<button onclick="alert(&quot;无关文本&quot;)">原样</button>';
  assert.equal(rewriteSchoolReferenceText(untouchedClick, exact), untouchedClick);
  const comment = '// historical reference "/primary-schools/alpha/"\nconst url="/primary-schools/alpha/";';
  assert.equal(rewriteSchoolReferenceText(comment, exact, { javascript: true }), '// historical reference "/primary-schools/alpha/"\nconst url="/primary-schools/#school-alpha-primary";');
  const dataAttribute = '<a data-href="/primary-schools/alpha/">data only</a>';
  assert.equal(rewriteSchoolReferenceText(dataAttribute, exact), dataAttribute);
});

test('reference traversal skips marked compatibility, maintenance JSON, new 8 database HTML and new frontend', async t => {
  const root = await fixture(t);
  const snippet = '<a href="/primary-schools/alpha/">甲</a>';
  for (const route of ['/school-database/', ...Object.values(CATEGORY_ROUTES)]) await put(root, `${route.slice(1)}index.html`, snippet);
  await put(root, 'assets/school-database.js', "const url='/primary-schools/alpha/';");
  await put(root, 'content/schools/database.json', JSON.stringify({ name: '/primary-schools/alpha/' }));
  await put(root, 'old/index.html', REDIRECT_MARKER + snippet);
  await put(root, 'blog/index.html', snippet);
  await put(root, 'existing.js', "const url='/primary-schools/alpha/';");
  const changed = await rewriteSchoolReferences(root, inputs());
  assert.deepEqual(changed.referencesChanged.sort(), ['blog/index.html', 'existing.js']);
  assert.equal(await fs.readFile(path.join(root, 'primary-schools/index.html'), 'utf8'), snippet);
  assert.equal(await fs.readFile(path.join(root, 'old/index.html'), 'utf8'), REDIRECT_MARKER + snippet);
  assert.deepEqual((await rewriteSchoolReferences(root, inputs())).referencesChanged, []);
});

test('rejects external/control/quote/path injections, self redirects, duplicate conflicts and wrong schools', () => {
  for (const bad of ['https://evil.org/x/', '//evil.org/x/', '/x/../y/', '/x/./', '/x%2fy/', '/x/\n', '/x/"/', '/x/;/', '/x/$uri/', '/中文/', '/x/?a=1', '/x/#school-a']) {
    const { policy, catalog } = inputs();
    policy.redirects[0].from = bad;
    assert.throws(() => prepareSchoolMigration(policy, catalog), /Unsafe|slash path/);
  }
  for (const bad of ['https://evil.org/x/', '/primary-schools/#school-wrong', '/primary-schools/\n', '/primary-schools/#school-alpha-primary"']) {
    const { policy, catalog } = inputs();
    policy.redirects[0].to = bad;
    assert.throws(() => prepareSchoolMigration(policy, catalog), /Unsafe|Wrong school|slash path/);
  }
  const conflict = inputs();
  conflict.policy.redirects.push({ ...conflict.policy.redirects[0] });
  assert.throws(() => prepareSchoolMigration(conflict.policy, conflict.catalog), /Duplicate\/conflicting/);
  const wrong = inputs();
  wrong.policy.redirects[0].recordId = 'beta-secondary';
  assert.throws(() => prepareSchoolMigration(wrong.policy, wrong.catalog), /Wrong school/);
  const protectedPath = inputs();
  protectedPath.catalog[0].legacyUrls.push('/primary-schools/');
  protectedPath.policy.redirects[0].from = '/primary-schools/';
  assert.throws(() => prepareSchoolMigration(protectedPath.policy, protectedPath.catalog), /Protected/);
  const retained = inputs();
  retained.catalog[1].legacyUrls.push(retained.catalog[1].detailUrl);
  retained.policy.redirects[2].from = retained.catalog[1].detailUrl;
  assert.throws(() => prepareSchoolMigration(retained.policy, retained.catalog), /Protected|Self/);
  const article = inputs();
  article.policy.redirects[0].from = '/primary-schools/admission-guide/';
  assert.throws(() => prepareSchoolMigration(article.policy, article.catalog), /not this school's legacy/);
});

test('rejects redirect chains/cycles even where detail aliases seem plausible', () => {
  const data = inputs();
  data.catalog[0].detailUrl = '/secondary-schools/beta/';
  data.catalog[2].detailUrl = '/primary-schools/alpha/';
  data.policy.retainedDetails.push('/secondary-schools/beta/', '/primary-schools/alpha/');
  data.policy.redirects[0].to = data.catalog[0].detailUrl;
  data.policy.redirects[1].to = data.catalog[0].detailUrl;
  data.policy.redirects[3].to = data.catalog[2].detailUrl;
  assert.throws(() => prepareSchoolMigration(data.policy, data.catalog), /Protected|chain|cycle/);
});

async function installFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seda-deploy-transaction-'));
  await fs.chmod(root, 0o700);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const site = path.join(root, 'www');
  await put(root, 'www/index.html', '<h1>fixture</h1>');
  const config = await put(root, 'nginx/sites-available/sgeda', `# Original site SSL/analytics/API must survive\nserver { listen 80; server_name sgeda.org.cn www.sgeda.org.cn; return 301 https://sgeda.org.cn$request_uri; }\nserver {\n    listen 443 ssl;\n    server_name www.sgeda.org.cn;\n    ssl_certificate /existing/www.pem;\n    return 301 https://sgeda.org.cn$request_uri;\n}\nserver {\n    listen 443 ssl http2;\n    server_name sgeda.org.cn;\n    root ${site};\n    ssl_certificate /existing/real.pem;\n    ssl_certificate_key /existing/real.key;\n    location /api/ { proxy_pass http://127.0.0.1:3002; }\n    location /analytics/ { proxy_pass http://127.0.0.1:3003; }\n    location / { try_files $uri $uri/ =404; }\n}\n`);
  const enabled = path.join(root, 'nginx/sites-enabled/sgeda');
  await fs.mkdir(path.dirname(enabled), { recursive: true });
  await fs.symlink(config, enabled);
  const include = await put(root, 'nginx/snippets/school-redirects.nginx.conf', '# previous include\n');
  const source = await put(root, 'generated.nginx.conf', renderSchoolNginxRules(prepareSchoolMigration(inputs().policy, inputs().catalog)));
  const log = path.join(root, 'commands.log');
  const nginx = await put(root, 'fake-nginx', `#!/bin/sh\necho "nginx $1" >> "$FIX_LOG"\nif [ "$1" = '-t' ] && [ "$FAIL_TEST" = '1' ]; then exit 1; fi\nif [ "$1" = '-T' ]; then\n  echo "# configuration file $FIX_ENABLED:"\n  cat "$FIX_ENABLED"\n  echo\n  if [ "$FAIL_DUMP" != '1' ] && grep -Fq "include $FIX_INCLUDE;" "$FIX_ENABLED"; then echo "# configuration file $FIX_INCLUDE:"; cat "$FIX_INCLUDE"; echo; fi\nfi\n`);
  const reload = await put(root, 'fake-systemctl', '#!/bin/sh\necho "systemctl $*" >> "$FIX_LOG"\nif [ "$FAIL_RELOAD" = "1" ]; then exit 1; fi\n');
  await fs.chmod(nginx, 0o755);
  await fs.chmod(reload, 0o755);
  const env = { ...process.env, FIX_LOG: log, FIX_ENABLED: enabled, FIX_INCLUDE: include };
  const baseArgs = [installer, '--test-mode', '--fixture-root', root, '--config', config, '--enabled-config', enabled, '--site-root', site, '--include-path', include, '--source', source, '--nginx-bin', nginx, '--reload-bin', reload];
  return { root, config, enabled, include, source, log, env, baseArgs, run: (extra = [], overrides = {}) => spawnSync('bash', [...baseArgs, ...extra], { encoding: 'utf8', env: { ...env, ...overrides } }) };
}

test('installer dry run leaves config/rules untouched and does not execute Nginx', async t => {
  const fix = await installFixture(t);
  const before = await fs.readFile(fix.config, 'utf8');
  const result = fix.run(['--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);
  assert.equal(await fs.readFile(fix.config, 'utf8'), before);
  assert.equal(await fs.readFile(fix.include, 'utf8'), '# previous include\n');
  await assert.rejects(fs.access(fix.log), /ENOENT/);
});

test('installer preserves original SSL/API/analytics, proves loaded, is idempotent and removes rules on rollback', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  const first = fix.run();
  assert.equal(first.status, 0, first.stderr);
  const current = await fs.readFile(fix.config, 'utf8');
  assert.ok(current.includes(gitGuard));
  assert.equal(current.replace(gitGuard, '').replace(/    # BEGIN SEDA_SCHOOL_REDIRECT_INCLUDE\n    include [^\n]+;\n    # END SEDA_SCHOOL_REDIRECT_INCLUDE\n/, ''), original);
  assert.match(current, /ssl_certificate \/existing\/real.pem/);
  assert.match(current, /location \/api\/ \{ proxy_pass http:\/\/127.0.0.1:3002;/);
  const log = await fs.readFile(fix.log, 'utf8');
  assert.equal(log, 'nginx -T\nnginx -t\nnginx -T\nsystemctl reload nginx\n');
  assert.equal(fix.run().status, 0);
  assert.equal(await fs.readFile(fix.config, 'utf8'), current);
  assert.equal(await fs.readFile(fix.log, 'utf8'), `${log}nginx -T\nnginx -t\nnginx -T\n`);
  assert.deepEqual(await fs.readdir(path.dirname(fix.enabled)), ['sgeda']);
  assert.equal(fix.run(['--remove']).status, 0);
  const removed = await fs.readFile(fix.config, 'utf8');
  assert.ok(removed.includes(gitGuard));
  assert.equal(removed.replace(gitGuard, ''), original);
  await assert.rejects(fs.access(fix.include), /ENOENT/);
});

test('nginx -t failure restores config/include and never reloads', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  const result = fix.run([], { FAIL_TEST: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /original disk config\/rules restored/);
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  assert.equal(await fs.readFile(fix.include, 'utf8'), '# previous include\n');
  assert.equal(await fs.readFile(fix.log, 'utf8'), 'nginx -T\nnginx -t\n');
});

test('missing nginx -T include proof restores configuration without reload', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  assert.notEqual(fix.run([], { FAIL_DUMP: '1' }).status, 0);
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  assert.equal(await fs.readFile(fix.log, 'utf8'), 'nginx -T\nnginx -t\nnginx -T\n');
});

test('reload failure restores disk configuration and does not claim success', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  const result = fix.run([], { FAIL_RELOAD: '1' });
  assert.notEqual(result.status, 0);
  assert.ok(!result.stdout.includes('Nginx reloaded'));
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  assert.equal(await fs.readFile(fix.include, 'utf8'), '# previous include\n');
});

test('installer refuses wrong root, disconnected enabled config and injected source before changes', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  await fs.writeFile(fix.config, original.replace(`root ${path.join(fix.root, 'www')};`, 'root /wrong/root;'));
  assert.notEqual(fix.run().status, 0);
  await fs.writeFile(fix.config, original);
  await fs.writeFile(fix.source, '# SEDA_SCHOOL_REDIRECT generated by scripts/migrate-school-pages.mjs\nlocation ^~ /primary-schools/ { return 301 https://evil.org/; }\n');
  assert.notEqual(fix.run().status, 0);
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  await fs.unlink(fix.enabled);
  assert.notEqual(fix.run().status, 0);
  assert.ok(!(await fs.readFile(fix.log, 'utf8')).includes('systemctl'));
});

// Optional local integration: standalone temporary Nginx, never /etc/nginx or production.
// CI without Nginx still runs all deterministic migration/installer fixtures above.
test('real temporary Nginx returns 301 for all variants with quoted fragments, keeps active articles/details and serves matching targets', async t => {
  if (spawnSync('nginx', ['-v'], { encoding: 'utf8' }).status !== 0) { t.skip('local nginx not installed'); return; }
  const { createServer } = await import('node:net');
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seda-deploy-transaction-'));
  await fs.chmod(root, 0o700);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await targetPages(root);
  await put(root, 'primary-schools/admission-guide/index.html', '<article>真实政策保留</article>');
  const { policy, catalog } = inputs();
  await migrateSchoolPages(root, { policy, catalog });
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const fixtureUser = process.getuid?.() === 0 ? `user ${os.userInfo().username};\n` : '';
  const conf = await put(root, 'nginx-fixture.conf', `${fixtureUser}pid ${root}/nginx.pid;\nerror_log ${root}/nginx-error.log;\nevents {}\nhttp { access_log off; client_body_temp_path ${root}/body; proxy_temp_path ${root}/proxy; fastcgi_temp_path ${root}/fastcgi; uwsgi_temp_path ${root}/uwsgi; scgi_temp_path ${root}/scgi; server { listen 127.0.0.1:${port}; server_name sgeda.org.cn; root ${root}; index index.html; include ${root}/data/seo/school-redirects.nginx.conf; location / { try_files $uri $uri/ =404; } } }\n`);
  const check = spawnSync('nginx', ['-p', `${root}/`, '-c', conf, '-t'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const nginx = spawn('nginx', ['-p', `${root}/`, '-c', conf, '-g', 'daemon off;'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  nginx.stderr.on('data', chunk => { errors += chunk; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch(`http://127.0.0.1:${port}/primary-schools/`, { redirect: 'manual' }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    assert.ok(ready, errors);
    for (const entry of policy.redirects) {
      for (const variant of sourceVariants(entry.from)) {
        const response = await fetch(`http://127.0.0.1:${port}${variant}?old=1`, { redirect: 'manual' });
        assert.equal(response.status, 301, variant);
        assert.equal(response.headers.get('location'), `https://sgeda.org.cn${entry.to}`, variant);
      }
      const [route, hash] = entry.to.split('#');
      const target = await fetch(`http://127.0.0.1:${port}${route}`, { redirect: 'manual' });
      assert.equal(target.status, 200);
      if (hash) assert.ok((await target.text()).includes(`id="${hash}"`));
    }
    for (const retained of ['/singapore-education/jc/alpha/', '/primary-schools/', '/primary-schools/admission-guide/']) {
      const response = await fetch(`http://127.0.0.1:${port}${retained}`, { redirect: 'manual' });
      assert.equal(response.status, 200, retained);
      assert.equal(response.headers.get('location'), null);
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/primary-schools/not-a-known-school/`, { redirect: 'manual' })).status, 404);
  } finally {
    if (nginx.exitCode === null) {
      const stopped = once(nginx, 'exit');
      nginx.kill('SIGTERM');
      await stopped;
    }
  }
});

test('target validation rejects data-id substitutes and noindex in any meta attribute order', async t => {
  const root = await fixture(t);
  await targetPages(root);
  await put(root, 'primary-schools/index.html', '<main data-id="school-alpha-primary">非真实id</main>');
  await assert.rejects(validateSchoolMigrationTargets(root, inputs()), /Missing school target fragment/);
  await put(root, 'primary-schools/index.html', '<meta content="noindex,follow" name="robots"><main id="school-alpha-primary">甲小学</main>');
  await assert.rejects(validateSchoolMigrationTargets(root, inputs()), /not active/);
});

test('failed first-time include installation restores absence of rules as well as original config', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  await fs.unlink(fix.include);
  assert.notEqual(fix.run([], { FAIL_TEST: '1' }).status, 0);
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  await assert.rejects(fs.access(fix.include), /ENOENT/);
  assert.equal(await fs.readFile(fix.log, 'utf8'), 'nginx -T\nnginx -t\n');
});

test('fixture installer refuses production config/enabled/include/site paths and symlink-equivalent include before reading or writing rules', async t => {
  const fix = await installFixture(t);
  const original = await fs.readFile(fix.config, 'utf8');
  for (const [option, value] of [
    ['--config', '/etc/nginx/sites-available/sgeda'],
    ['--enabled-config', '/etc/nginx/sites-enabled/sgeda'],
    ['--include-path', '/etc/nginx/snippets/school-redirects.nginx.conf'],
    ['--site-root', '/var/www/sgeda'],
  ]) {
    const result = fix.run([option, value]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Test mode cannot access production or non-fixture paths/);
  }
  const linkedParent = path.join(fix.root, 'production-snippets-link');
  await fs.symlink('/etc/nginx/snippets', linkedParent);
  const result = fix.run(['--include-path', path.join(linkedParent, 'school-redirects.nginx.conf')]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Symlink paths are not permitted/);
  const omittedIncludeArgs = [...fix.baseArgs];
  omittedIncludeArgs.splice(omittedIncludeArgs.indexOf('--include-path'), 2);
  const omitted = spawnSync('bash', omittedIncludeArgs, { encoding: 'utf8', env: fix.env });
  assert.notEqual(omitted.status, 0);
  assert.match(omitted.stderr, /Test mode cannot access production or non-fixture paths/);
  assert.equal(await fs.readFile(fix.config, 'utf8'), original);
  assert.equal(await fs.readFile(fix.include, 'utf8'), '# previous include\n');
  await assert.rejects(fs.access(fix.log), /ENOENT/);
});
