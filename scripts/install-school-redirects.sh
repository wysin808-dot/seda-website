#!/usr/bin/env bash
# Install/remove exact school redirects in the EXISTING canonical TLS server.
# Never copies the repository nginx.conf over production. No network operations.
set -euo pipefail
command -v python3 >/dev/null || { echo 'python3 is required' >&2; exit 1; }
exec python3 - "$@" <<'PY'
import argparse
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import sys
import tempfile

MARKER_START = '# BEGIN SEDA_SCHOOL_REDIRECT_INCLUDE'
MARKER_END = '# END SEDA_SCHOOL_REDIRECT_INCLUDE'
DEFAULT_CONFIG = '/etc/nginx/sites-available/sgeda'
DEFAULT_ENABLED = '/etc/nginx/sites-enabled/sgeda'
DEFAULT_INCLUDE = '/etc/nginx/snippets/school-redirects.nginx.conf'
DEFAULT_ROOT = '/var/www/sgeda'

parser = argparse.ArgumentParser(description='Preserve existing TLS/API configuration; validate before reload; restore on failure.')
parser.add_argument('--source', default='data/seo/school-redirects.nginx.conf')
parser.add_argument('--config', default=DEFAULT_CONFIG)
parser.add_argument('--enabled-config', default=DEFAULT_ENABLED)
parser.add_argument('--include-path', default=DEFAULT_INCLUDE)
parser.add_argument('--site-root', default=DEFAULT_ROOT)
parser.add_argument('--nginx-bin', default='nginx')
parser.add_argument('--reload-bin', default='systemctl', help='Called with: reload nginx')
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--remove', action='store_true', help='Remove the managed include and its rules, then test/reload')
parser.add_argument('--test-mode', action='store_true', help='Fixture-only paths; never permits real production config')
args = parser.parse_args()


def fail(message):
    raise RuntimeError(message)


def tokens(text):
    # Token offsets allow inserting a server-level include without touching other bytes.
    result = []
    i = 0
    while i < len(text):
        if text[i].isspace():
            i += 1
            continue
        if text[i] == '#':
            end = text.find('\n', i)
            i = len(text) if end < 0 else end + 1
            continue
        start = i
        if text[i] in '{};':
            result.append((text[i], i, i + 1))
            i += 1
        elif text[i] in '\"\'':
            quote = text[i]
            i += 1
            value = ''
            while i < len(text) and text[i] != quote:
                if text[i] == '\\' and i + 1 < len(text):
                    i += 1
                value += text[i]
                i += 1
            if i >= len(text):
                fail('Unterminated Nginx string')
            i += 1
            result.append((value, start, i))
        else:
            while i < len(text) and not text[i].isspace() and text[i] not in '{};#':
                i += 1
            if i == start:
                fail('Cannot parse Nginx config')
            result.append((text[start:i], start, i))
    return result


def server_blocks(text):
    ts = tokens(text)
    blocks = []
    for i, token in enumerate(ts[:-1]):
        if token[0] != 'server' or ts[i + 1][0] != '{':
            continue
        depth = 1
        directive = []
        directives = []
        j = i + 2
        while j < len(ts) and depth:
            value = ts[j][0]
            if value == '{':
                depth += 1
                directive = []
            elif value == '}':
                depth -= 1
                directive = []
            elif depth == 1:
                if value == ';':
                    if directive:
                        directives.append(directive)
                    directive = []
                else:
                    directive.append(ts[j])
            j += 1
        if depth:
            fail('Unbalanced Nginx server block')
        blocks.append((ts[i + 1][2], ts[j - 1][1], directives))
    return blocks


def canonical_block(text):
    candidates = []
    for start, end, directives in server_blocks(text):
        names = [t[0] for d in directives if d[0][0] == 'server_name' for t in d[1:]]
        roots = [d[1][0] for d in directives if d[0][0] == 'root' and len(d) == 2]
        tls = any(d[0][0] == 'listen' and any(t[0] == 'ssl' for t in d[1:])
                  and any(re.search(r'(?:^|:)443$', t[0]) for t in d[1:]) for d in directives)
        if 'sgeda.org.cn' in names and roots == [args.site_root] and tls:
            candidates.append((start, end, directives))
    if len(candidates) != 1:
        fail('Expected exactly one sgeda.org.cn TLS server with exact root ' + args.site_root)
    return candidates[0]


def transform(text):
    start, end, directives = canonical_block(text)
    fragment = text[start:end]
    managed = re.compile(r'(?m)^[ \t]*' + re.escape(MARKER_START) + r'\n[\s\S]*?^[ \t]*' + re.escape(MARKER_END) + r'[ \t]*\n?')
    matches = list(managed.finditer(text))
    if len(matches) > 1 or text.count(MARKER_START) != len(matches) or text.count(MARKER_END) != len(matches):
        fail('Ambiguous or malformed managed include marker')
    if matches and not (start <= matches[0].start() < matches[0].end() <= end):
        fail('Managed include is outside canonical TLS server')
    if matches:
        inside = text[matches[0].start():matches[0].end()]
        values = tokens(inside)
        if [token[0] for token in values] != ['include', args.include_path, ';']:
            fail('Managed section contains unrelated configuration; refusing overwrite')
        text = text[:matches[0].start()] + text[matches[0].end():]
    start, end, directives = canonical_block(text)
    for _, _, ds in server_blocks(text):
        for d in ds:
            if d[0][0] == 'include' and len(d) == 2 and d[1][0] == args.include_path:
                fail('Unmanaged school include already exists; mark/review it explicitly')
    if args.remove:
        return text
    # Insert directly at server scope, before its closing brace, never within location /api/.
    insertion = f'    {MARKER_START}\n    include {args.include_path};\n    {MARKER_END}\n'
    line_start = text.rfind('\n', 0, end) + 1
    if text[line_start:end].strip():
        line_start = end
        insertion = '\n' + insertion
    return text[:line_start] + insertion + text[line_start:]


def validate_rules(data):
    try:
        text = data.decode('ascii')
    except UnicodeDecodeError:
        fail('Generated Nginx rules must be ASCII')
    if not text.startswith('# SEDA_SCHOOL_REDIRECT generated by scripts/migrate-school-pages.mjs\n'):
        fail('Not a generated SEDA school include')
    expression = re.compile(r'location = (/[A-Za-z0-9._~/-]+) \{ return 301 "https://sgeda\.org\.cn(/[A-Za-z0-9._~/-]+(?:#school-[a-z0-9-]+)?)"; \}')
    seen = set()
    count = 0
    for line in text.splitlines():
        if not line or line.startswith('#'):
            continue
        match = expression.fullmatch(line)
        if not match:
            fail('Unsafe or non-exact generated rule: ' + line)
        source, target = match.groups()
        for value in [source, target.split('#')[0]]:
            if '//' in value or any(part in ('.', '..') for part in value.split('/')):
                fail('Unsafe rule path')
        if source in seen or source.rstrip('/') == target.split('#')[0].rstrip('/'):
            fail('Duplicate or self-redirect rule')
        seen.add(source)
        count += 1
    if count == 0:
        fail('Refusing an empty generated school include')


def snapshot(file):
    if not file.exists():
        return None
    info = file.stat()
    return file.read_bytes(), stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid


def atomic_write(file, content, original=None):
    fd, temp = tempfile.mkstemp(prefix='.' + file.name + '.', dir=file.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temp, original[1] if original else 0o644)
        if original and os.geteuid() == 0:
            os.chown(temp, original[2], original[3])
        os.replace(temp, file)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def restore(file, before):
    if before is None:
        file.unlink(missing_ok=True)
    else:
        atomic_write(file, before[0], before)


def check_loaded(config, enabled, include):
    subprocess.run([args.nginx_bin, '-t'], check=True)
    # Prove these files are really loaded, not merely present on disk.
    dump = subprocess.run([args.nginx_bin, '-T'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout
    if not any(f'# configuration file {file}:' in dump for file in (config, enabled)):
        fail('nginx -T does not load sites-available/sgeda')
    if not args.remove and f'# configuration file {include}:' not in dump:
        fail('nginx -T does not load the generated school include')


try:
    config = Path(args.config)
    enabled = Path(args.enabled_config)
    include = Path(args.include_path)
    site = Path(args.site_root)
    if not all(p.is_absolute() for p in [config, enabled, include, site]):
        fail('Config, enabled-config, include-path and site-root must be absolute')
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+', args.include_path) or '..' in include.parts:
        fail('Unsafe include path')
    if args.test_mode:
        protected = {Path(value).resolve() for value in (DEFAULT_CONFIG, DEFAULT_ENABLED, DEFAULT_INCLUDE, DEFAULT_ROOT)}
        production_roots = [Path('/etc/nginx').resolve(), Path(DEFAULT_ROOT).resolve()]
        resolved_paths = [file.resolve() for file in (config, enabled, include, site)]
        if any(file in protected or any(file == base or base in file.parents for base in production_roots) for file in resolved_paths):
            fail('Test mode cannot alter production paths')
    elif (str(config), str(enabled), str(include), str(site)) != (DEFAULT_CONFIG, DEFAULT_ENABLED, DEFAULT_INCLUDE, DEFAULT_ROOT):
        fail('Non-production paths require explicit --test-mode')
    if not site.is_dir() or not (site / 'index.html').is_file():
        fail('Site directory/index.html does not exist')
    if not config.is_file() or config.is_symlink():
        fail('Config must be a real sites-available file')
    if not enabled.is_file() or enabled.resolve() != config.resolve():
        fail('sites-enabled must load this exact sites-available config')
    if include.is_symlink() or not include.parent.is_dir():
        fail('Include parent directory must exist and include cannot be a symlink')
    before_config = snapshot(config)
    before_include = snapshot(include)
    content = transform(before_config[0].decode('utf-8')).encode('utf-8')
    rules = None if args.remove else Path(args.source).read_bytes()
    if rules is not None:
        validate_rules(rules)
    if args.dry_run:
        print('DRY RUN: no files, nginx commands or reloads executed')
        print(content.decode('utf-8'))
        sys.exit(0)
    if content == before_config[0] and ((args.remove and before_include is None) or (not args.remove and before_include and rules == before_include[0])):
        check_loaded(config, enabled, include)
        print('School include already in requested state; nothing changed/reloaded')
        sys.exit(0)
    try:
        if rules is not None:
            atomic_write(include, rules, before_include)
        atomic_write(config, content, before_config)
        if args.remove:
            include.unlink(missing_ok=True)
        check_loaded(config, enabled, include)
        subprocess.run([args.reload_bin, 'reload', 'nginx'], check=True)
    except BaseException:
        restore(config, before_config)
        restore(include, before_include)
        print('School include installation failed; original disk config/rules restored', file=sys.stderr)
        raise
    print('School redirects removed and Nginx reloaded' if args.remove else 'School redirects installed, nginx -t/-T passed and Nginx reloaded')
except Exception as error:
    print('ERROR: ' + str(error), file=sys.stderr)
    sys.exit(1)
PY
