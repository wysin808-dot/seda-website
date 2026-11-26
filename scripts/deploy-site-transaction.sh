#!/usr/bin/env bash
# Source this from a private bootstrap file BEFORE the first write to the live site.
# Core commit: frontend validation + school redirect installation/reload succeeded.
# Maintenance after commit must fail visibly, but must NOT reverse that core commit.

# Shared Python library, emitted rather than imported from the old live checkout.
# The installer sources this helper and prepends the SAME library to its program.
deploy_site_nginx_python() {
  cat <<'NGINX_PY'
import os
from pathlib import Path
import re
import stat
import subprocess


def fail(message):
    raise RuntimeError(message)


def no_link_ancestors(path):
    for part in [path, *path.parents]:
        if part.is_symlink():
            fail('Symlink paths are not permitted: ' + str(part))


def absolute_path(value):
    path = Path(value)
    if (not path.is_absolute() or '..' in path.parts
            or str(path) != str(value) or not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(path))):
        fail('Unsafe absolute path')
    return path


def private_fixture(value):
    if not value:
        fail('Test mode requires a private fixture root')
    root = absolute_path(value)
    no_link_ancestors(root)
    if not re.fullmatch(r'/tmp/seda-deploy-transaction-[A-Za-z0-9_-]+', str(root)) or not root.is_dir():
        fail('Test mode requires an isolated /tmp/seda-deploy-transaction-* fixture')
    info = root.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Fixture root must be owned by this user with mode 0700')
    return root


def confined(path, root):
    path = absolute_path(path)
    if root not in path.parents:
        fail('Test mode cannot access production or non-fixture paths' if str(root).startswith('/tmp/')
             else 'Nginx config target must be inside /etc/nginx')
    return path


def config_target(value, tree):
    """Only a leaf sites-enabled symlink may alias a confined regular file."""
    path = confined(value, tree)
    no_link_ancestors(path.parent)
    if path.is_symlink():
        if path.parent != tree / 'sites-enabled':
            fail('Only a sites-enabled config alias may be a symlink: ' + str(path))
        target = Path(os.path.abspath(path.parent / os.readlink(path)))
        confined(target, tree)  # reject escape BEFORE following/reading its target
        no_link_ancestors(target)
        if not target.is_file():
            fail('Loaded config alias must target a regular file: ' + str(path))
        return target
    if not path.is_file() or not stat.S_ISREG(path.stat().st_mode):
        fail('Loaded Nginx config must be a regular file: ' + str(path))
    return path


def regular_destination(path):
    no_link_ancestors(path)
    if not path.parent.is_dir() or (path.exists() and not stat.S_ISREG(path.stat().st_mode)):
        fail('Nginx destination must have a real parent and be a regular file: ' + str(path))


def tokens(text):
    # Lifted from the installer: offsets preserve ALL non-managed bytes.
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
            value = ''
            while i < len(text) and not text[i].isspace() and text[i] not in '{};#':
                if text[i] == '\\' and i + 1 < len(text):
                    i += 1
                value += text[i]
                i += 1
            if i == start:
                fail('Cannot parse Nginx config')
            result.append((value, start, i))
    return result


def server_blocks(text):
    ts = tokens(text)
    blocks = []
    def syntax(token, value):
        return token[0] == value and text[token[1]:token[2]] == value
    for i, token in enumerate(ts[:-1]):
        if token[0] != 'server' or not syntax(ts[i + 1], '{'):
            continue
        depth = 1
        directive = []
        directives = []
        j = i + 2
        while j < len(ts) and depth:
            if syntax(ts[j], '{'):
                depth += 1
                directive = []
            elif syntax(ts[j], '}'):
                depth -= 1
                directive = []
            elif depth == 1:
                if syntax(ts[j], ';'):
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


def canonical_blocks(text, site_root):
    candidates = []
    for start, end, directives in server_blocks(text):
        names = [t[0] for d in directives if d[0][0] == 'server_name' for t in d[1:]]
        roots = [d[1][0] for d in directives if d[0][0] == 'root' and len(d) == 2]
        tls = any(d[0][0] == 'listen' and len(d) >= 3 and d[1][0] != 'ssl'
                  and re.fullmatch(r'(?:443|(?:[A-Za-z0-9_.-]+|\*|\[[A-Za-z0-9:.%_-]+\]):443)', d[1][0])
                  and any(t[0] == 'ssl' for t in d[2:]) for d in directives)
        if 'sgeda.org.cn' in names and roots == [str(site_root)] and tls:
            candidates.append((start, end, directives))
    return candidates


def canonical_block(text, site_root):
    candidates = canonical_blocks(text, site_root)
    if len(candidates) != 1:
        fail('Expected exactly one sgeda.org.cn TLS server with exact root ' + str(site_root))
    return candidates[0]


def nginx_command(binary, option):
    # Never forward Nginx's full config/diagnostics (may contain secret directives).
    result = subprocess.run([binary, option], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    if result.returncode:
        fail('Nginx validation failed at ' + option)
    return result.stdout


def loaded_sources(dump, tree):
    matches = list(re.finditer(rb'^# configuration file ([^\r\n]+):\r?\n', dump, re.M))
    if not matches:
        fail('nginx -T has no loaded configuration source headers')
    result = []
    seen = set()
    for index, match in enumerate(matches):
        try:
            path = absolute_path(match[1].decode('ascii'))
        except (UnicodeError, ValueError):
            fail('Unsafe nginx -T source path')
        # Headers are captured data, not filesystem access. Unrelated TLS includes
        # may be outside /etc/nginx; config_target confines every writable candidate
        # BEFORE reading disk bytes. No non-candidate source is read or modified.
        if path in seen:
            fail('Repeated nginx -T source header: ' + str(path))
        seen.add(path)
        body = dump[match.end():matches[index + 1].start() if index + 1 < len(matches) else len(dump)]
        result.append((path, body))
    return result


def discover_loaded(binary, tree, site_root, expected_config=None, expected_loaded=None):
    sources = loaded_sources(nginx_command(binary, '-T'), tree)
    candidates = []
    for origin, body in sources:
        # Parse the dump first; only candidate source bytes need to be read.
        text = body.decode('utf-8', errors='surrogateescape')
        blocks = canonical_blocks(text, site_root)
        if not blocks:
            continue
        target = config_target(origin, tree)
        data = target.read_bytes()
        # Nginx prints a separating newline after each dumped source. No globbing,
        # guessed filenames or disk-only candidates participate in discovery.
        if body not in (data, data + b'\n', data + b'\n\n'):
            fail('Loaded source differs from on-disk config: ' + str(origin))
        canonical_block(data.decode('utf-8', errors='surrogateescape'), site_root)
        candidates.extend((target, origin, data) for _ in blocks)
    if len(candidates) != 1:
        fail('Expected exactly one LOADED sgeda.org.cn 443 ssl server with exact root ' + str(site_root))
    target, origin, data = candidates[0]
    if expected_config and config_target(expected_config, tree) != target:
        fail('Requested config is not the uniquely loaded canonical config')
    if expected_loaded and (absolute_path(expected_loaded) != origin
                            or config_target(expected_loaded, tree) != target):
        fail('Requested enabled config is not the actually loaded source')
    return target, origin, data, sources
NGINX_PY
}

deploy_site_transaction_files() {
  python3 - "$@" < <(deploy_site_nginx_python; cat <<'PY'
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile

p = argparse.ArgumentParser()
p.add_argument('operation', choices=['lock', 'begin', 'selection', 'verify-nginx', 'checkpoint-cms', 'restore'])
p.add_argument('--site-root', default='/var/www/sgeda')
p.add_argument('--config', help='Optional assertion against the discovered regular config')
p.add_argument('--enabled-config', help='Optional assertion against the actual loaded source/alias')
p.add_argument('--include-path', default='/etc/nginx/snippets/school-redirects.nginx.conf')
p.add_argument('--nginx-bin', default='nginx')
p.add_argument('--reload-bin', default='systemctl')
p.add_argument('--git-bin', default='git')
p.add_argument('--test-mode', action='store_true')
p.add_argument('--fixture-root')
p.add_argument('--backup')
p.add_argument('--restore-nginx', action='store_true')
a = p.parse_args()


# Validate every fixture path BEFORE any site/config bytes or command invocation.
site, include = absolute_path(a.site_root), absolute_path(a.include_path)
config = absolute_path(a.config) if a.config else None
enabled = absolute_path(a.enabled_config) if a.enabled_config else None
if a.test_mode:
    root = private_fixture(a.fixture_root)
    tree = root / 'nginx'
    for path in [site, include, Path(a.nginx_bin), Path(a.reload_bin), Path(a.git_bin),
                 *([Path(a.backup)] if a.backup else [])]:
        confined(path, root)
        no_link_ancestors(path)
    for path in [config, enabled]:
        if path is not None:
            confined(path, tree)
            no_link_ancestors(path.parent)
    for base, dirs, files in os.walk(site, followlinks=False):
        for name in dirs + files:
            if (Path(base) / name).is_symlink():
                fail('Fixture site cannot contain symlinks')
else:
    tree = Path('/etc/nginx')
    if a.fixture_root or (str(site), str(include)) != (
        '/var/www/sgeda', '/etc/nginx/snippets/school-redirects.nginx.conf'
    ) or (a.nginx_bin, a.reload_bin, a.git_bin) != ('nginx', 'systemctl', 'git'):
        fail('Non-production paths/commands require explicit isolated test mode')
    no_link_ancestors(site)
    for path in [config, enabled]:
        if path is not None:
            confined(path, tree)
            no_link_ancestors(path.parent)
regular_destination(include)

# Sources are snapshotted privately, but NEVER deleted during rollback. Mutable data
# and secrets are neither read nor restored. This includes CMS media and queues/state.
def protected(relative):
    parts = Path(relative).parts
    return (parts[0] in {'.git', 'node_modules', 'reports', '.vercel', '.claude'}
            or any(part.startswith('.env') for part in parts)
            or relative == 'assets/uploads' or relative.startswith('assets/uploads/')
            or any(relative == prefix or relative.startswith(prefix + '/') for prefix in
                   ('data/analytics', 'data/leads', 'data/cms'))
            or (relative.startswith('data/seo/') and fnmatch.fnmatch(parts[-1], '*state*.json'))
            or any(fnmatch.fnmatch(parts[-1], pattern) for pattern in
                   ('*.jsonl', '*.log', '*.sqlite', '*.sqlite-*', '*.db', '*.db-*')))


def cms_source(relative):
    return relative == 'content/keyword-queue.csv' or relative == 'content/articles' or relative.startswith('content/articles/')


def source_signature(file):
    if file.is_symlink():
        return 'link:' + os.readlink(file)
    if file.is_file():
        return hashlib.sha256(file.read_bytes()).hexdigest()
    return None


def entries(root):
    found = []
    def visit(folder, prefix=''):
        for item in sorted(folder.iterdir()):
            relative = prefix + item.name
            if protected(relative):
                continue
            found.append(relative)
            if item.is_dir() and not item.is_symlink():
                visit(item, relative + '/')
    visit(root)
    return found


def copy_entry(source, target):
    if source.is_symlink():
        target.symlink_to(os.readlink(source))
    elif source.is_dir():
        target.mkdir(exist_ok=True)
    elif source.is_file():
        shutil.copy2(source, target, follow_symlinks=False)
    else:
        fail('Unsupported site file type: ' + str(source))
    if not source.is_symlink() and os.geteuid() == 0:
        info = source.stat()
        os.chown(target, info.st_uid, info.st_gid)


def remove(path):
    if path.is_dir() and not path.is_symlink():
        # Never recursively erase a directory: protected/new runtime children may live here.
        try:
            path.rmdir()
        except OSError:
            if not any(path.iterdir()):
                raise
    else:
        path.unlink()


if a.operation == 'lock':
    directory = root / 'locks' if a.test_mode else Path('/var/tmp/sgeda-site-deploy-lock')
    no_link_ancestors(directory)
    directory.mkdir(mode=0o700, exist_ok=True)
    info = directory.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Deployment lock directory must be private and owned by this user')
    lock = directory / 'site.lock'
    no_link_ancestors(lock)
    fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    print(lock)
elif a.operation == 'begin':
    if not site.is_dir() or not (site / 'index.html').is_file():
        fail('Live site/index.html must already exist')
    config, enabled, _, _ = discover_loaded(a.nginx_bin, tree, site, config, enabled)
    print('Selected loaded Nginx source: ' + str(enabled) + ' -> ' + str(config), file=__import__('sys').stderr)
    old_umask = os.umask(0o077)
    try:
        backup = Path(tempfile.mkdtemp(prefix='sgeda-site-transaction-', dir=str(root) if a.test_mode else '/var/tmp'))
        before = backup / 'before'
        before.mkdir(mode=0o700)
        manifest = entries(site)
        for relative in manifest:
            copy_entry(site / relative, before / relative)
        # Restore directory metadata only after children have been copied.
        for relative in reversed(manifest):
            if (site / relative).is_dir() and not (site / relative).is_symlink():
                shutil.copystat(site / relative, before / relative)
        nginx = {}
        for name, file in [('config', config), ('include', include)]:
            nginx[name] = file.exists()
            if file.exists():
                copy_entry(file, backup / name)
        (backup / 'manifest.json').write_text(json.dumps({'paths': manifest, 'nginx': nginx,
            'nginx_paths': {'config': str(config), 'loaded': str(enabled), 'include': str(include)}}))
        print(backup)
    finally:
        os.umask(old_umask)
elif a.operation in ('selection', 'verify-nginx'):
    if not a.backup:
        fail('Selection/verification requires a private backup')
    backup = absolute_path(a.backup)
    no_link_ancestors(backup)
    info = backup.stat()
    if not backup.is_dir() or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Unsafe selection backup owner/permissions')
    metadata = backup / 'manifest.json'
    no_link_ancestors(metadata)
    selected = json.loads(metadata.read_text())['nginx_paths']
    config = config_target(selected['config'], tree)
    enabled = absolute_path(selected['loaded'])
    if config_target(enabled, tree) != config or str(include) != selected['include']:
        fail('Saved selection paths changed')
    if a.operation == 'verify-nginx':
        nginx_command(a.nginx_bin, '-t')
        discover_loaded(a.nginx_bin, tree, site, config, enabled)
    else:
        print(config)
        print(enabled)
elif a.operation == 'checkpoint-cms':
    if not a.backup:
        fail('CMS checkpoint requires the private deployment backup')
    backup = Path(a.backup)
    no_link_ancestors(backup)
    if not backup.is_dir() or site == backup or site in backup.parents:
        fail('CMS checkpoint backup must be outside the live root')
    info = backup.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Unsafe CMS checkpoint backup owner/permissions')
    checkpoint = backup / 'cms-checkpoint.json'
    no_link_ancestors(checkpoint)
    signatures = {relative: source_signature(site / relative) for relative in entries(site)
                  if cms_source(relative) and not (site / relative).is_dir()}
    fd = os.open(checkpoint, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(signatures, output)
else:
    if not a.backup:
        fail('Rollback requires a private backup')
    backup = Path(a.backup)
    no_link_ancestors(backup)
    if not backup.is_dir() or site == backup or site in backup.parents:
        fail('Backup must be outside the live root')
    info = backup.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Unsafe backup owner/permissions')
    if a.test_mode:
        for base, dirs, files in os.walk(backup, followlinks=False):
            for name in dirs + files:
                if (Path(base) / name).is_symlink():
                    fail('Fixture backup cannot contain symlinks')
    saved = json.loads((backup / 'manifest.json').read_text())
    for relative in saved['paths']:
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or any(part in ('', '.', '..') for part in relative.split('/')):
            fail('Unsafe path in frontend backup manifest')
    selected = saved['nginx_paths']
    config = config_target(selected['config'], tree)
    enabled = absolute_path(selected['loaded'])
    if config_target(enabled, tree) != config or str(include) != selected['include']:
        fail('Rollback config/loaded alias no longer matches the saved selection')
    original = set(saved['paths'])
    checkpoint_file = backup / 'cms-checkpoint.json'
    checkpoint = json.loads(checkpoint_file.read_text()) if checkpoint_file.exists() else None
    # Delete newly public paths, but never delete new CMS sources or mutable data.
    for relative in reversed(entries(site)):
        if relative not in original and not cms_source(relative):
            remove(site / relative)
    for relative in saved['paths']:
        old, target = backup / 'before' / relative, site / relative
        if checkpoint is not None and cms_source(relative) and not old.is_dir() and source_signature(target) != checkpoint.get(relative):
            print('Preserved CMS source edited after deployment checkpoint: ' + relative)
            continue
        # Do not follow a changed destination symlink when copying old bytes.
        if target.is_symlink() or (target.exists() and old.is_dir() != target.is_dir()):
            remove(target)
        if old.is_symlink():
            if target.exists() or target.is_symlink():
                remove(target)
        copy_entry(old, target)
    for relative in reversed(saved['paths']):
        old, target = backup / 'before' / relative, site / relative
        if old.is_dir() and not old.is_symlink():
            shutil.copystat(old, target)
    # The installer also restores its own disk changes. Restore our exact initial
    # bytes defensively; the shell then tests/proves/reloads the old live generation.
    for name, file in [('config', config), ('include', include)]:
        if not a.restore_nginx:
            continue
        if saved['nginx'][name]:
            fd, temp = tempfile.mkstemp(prefix='.seda-rollback-', dir=file.parent)
            os.close(fd)
            try:
                copy_entry(backup / name, Path(temp))
                os.replace(temp, file)
            finally:
                if os.path.exists(temp):
                    os.unlink(temp)
        elif file.exists() or file.is_symlink():
            file.unlink()
PY
  )
}

deploy_site_transaction_begin() {
  DEPLOY_TX_ARGS=("$@")
  local lock_file selection
  lock_file="$(deploy_site_transaction_files lock "${DEPLOY_TX_ARGS[@]}")" || return
  exec {DEPLOY_TX_LOCK_FD}>"$lock_file"
  flock "$DEPLOY_TX_LOCK_FD"
  DEPLOY_TX_BACKUP="$(deploy_site_transaction_files begin "${DEPLOY_TX_ARGS[@]}")" || return
  DEPLOY_TX_SITE=/var/www/sgeda
  DEPLOY_TX_CONFIG=
  DEPLOY_TX_ENABLED=
  DEPLOY_TX_FIXTURE_ROOT=
  DEPLOY_TX_INCLUDE=/etc/nginx/snippets/school-redirects.nginx.conf
  DEPLOY_TX_NGINX_BIN=nginx
  DEPLOY_TX_RELOAD_BIN=systemctl
  DEPLOY_TX_GIT_BIN=git
  DEPLOY_TX_TEST_MODE=0
  while (($#)); do
    case "$1" in
      --site-root) DEPLOY_TX_SITE="$2"; shift 2;;
      --config) DEPLOY_TX_CONFIG="$2"; shift 2;;
      --enabled-config) DEPLOY_TX_ENABLED="$2"; shift 2;;
      --include-path) DEPLOY_TX_INCLUDE="$2"; shift 2;;
      --nginx-bin) DEPLOY_TX_NGINX_BIN="$2"; shift 2;;
      --reload-bin) DEPLOY_TX_RELOAD_BIN="$2"; shift 2;;
      --git-bin) DEPLOY_TX_GIT_BIN="$2"; shift 2;;
      --test-mode) DEPLOY_TX_TEST_MODE=1; shift;;
      --fixture-root) DEPLOY_TX_FIXTURE_ROOT="$2"; shift 2;;
      *) echo 'Unsupported deployment transaction option' >&2; return 1;;
    esac
  done
  selection="$(deploy_site_transaction_files selection "${DEPLOY_TX_ARGS[@]}" --backup "$DEPLOY_TX_BACKUP")" || return
  DEPLOY_TX_CONFIG="${selection%%$'\n'*}"
  DEPLOY_TX_ENABLED="${selection#*$'\n'}"
  DEPLOY_TX_PREVIOUS_SHA="$("$DEPLOY_TX_GIT_BIN" -C "$DEPLOY_TX_SITE" rev-parse HEAD)" || return
  DEPLOY_TX_COMMITTED=0
  DEPLOY_TX_NGINX_ATTEMPTED=0
  DEPLOY_TX_NGINX_SUCCEEDED=0
  trap 'deploy_site_transaction_exit "$?"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  echo "Frontend transaction started; private backup: $DEPLOY_TX_BACKUP"
}

deploy_site_transaction_checkpoint_cms() {
  # Call immediately after CMS merge/restore, before potentially long ci/build/test.
  deploy_site_transaction_files checkpoint-cms "${DEPLOY_TX_ARGS[@]}" --backup "$DEPLOY_TX_BACKUP"
}

deploy_site_transaction_install_redirects() {
  local installer="$1"
  local args=(--source "$DEPLOY_TX_SITE/data/seo/school-redirects.nginx.conf"
    --config "$DEPLOY_TX_CONFIG" --enabled-config "$DEPLOY_TX_ENABLED")
  if ((DEPLOY_TX_TEST_MODE)); then
    args+=(--test-mode --fixture-root "$DEPLOY_TX_FIXTURE_ROOT" --site-root "$DEPLOY_TX_SITE"
      --include-path "$DEPLOY_TX_INCLUDE"
      --nginx-bin "$DEPLOY_TX_NGINX_BIN" --reload-bin "$DEPLOY_TX_RELOAD_BIN")
  fi
  DEPLOY_TX_NGINX_ATTEMPTED=1
  if bash "$installer" "${args[@]}"; then
    DEPLOY_TX_NGINX_SUCCEEDED=1
  else
    return "$?"
  fi
}

deploy_site_transaction_commit() {
  # Call immediately after install_redirects succeeded, BEFORE maintenance.
  if (( ! DEPLOY_TX_NGINX_SUCCEEDED )); then
    echo 'ERROR: refusing core commit before successful school redirect installation' >&2
    return 1
  fi
  DEPLOY_TX_COMMITTED=1
  echo 'CORE COMMIT: frontend and loaded school redirects now match; later maintenance failures do not roll this generation back.'
  (cd /; rm -rf -- "$DEPLOY_TX_BACKUP")
}

deploy_site_transaction_exit() {
  local status="$1" rollback_failed=0
  local restore_args=()
  trap - EXIT INT TERM
  if (( ! DEPLOY_TX_COMMITTED )); then
    # A forgotten commit is not success. Keep failure backups private for recovery.
    ((status != 0)) || status=1
    echo 'Core deploy failed; restoring the actual served frontend' >&2
    if ! "$DEPLOY_TX_GIT_BIN" -C "$DEPLOY_TX_SITE" reset --mixed "$DEPLOY_TX_PREVIOUS_SHA"; then
      rollback_failed=1
    fi
    if ((DEPLOY_TX_NGINX_ATTEMPTED)); then restore_args+=(--restore-nginx); fi
    if ! deploy_site_transaction_files restore "${DEPLOY_TX_ARGS[@]}" --backup "$DEPLOY_TX_BACKUP" "${restore_args[@]}"; then
      rollback_failed=1
    fi
    if ((DEPLOY_TX_NGINX_ATTEMPTED)); then
      if deploy_site_transaction_files verify-nginx "${DEPLOY_TX_ARGS[@]}" --backup "$DEPLOY_TX_BACKUP" &&
         "$DEPLOY_TX_RELOAD_BIN" reload nginx; then
        echo 'Restored Nginx generation validated and reloaded' >&2
      else
        echo 'ERROR: restored Nginx could not be verified/reloaded; manual recovery required' >&2
        rollback_failed=1
      fi
    fi
    if ((rollback_failed)); then
      echo "ERROR: rollback incomplete; private recovery backup retained at $DEPLOY_TX_BACKUP" >&2
      status=70
    else
      echo "Frontend rollback complete; private backup retained at $DEPLOY_TX_BACKUP" >&2
    fi
  elif ((status != 0)); then
    echo 'ERROR: post-commit maintenance failed; committed frontend/301 generation retained' >&2
  fi
  if ! flock -u "$DEPLOY_TX_LOCK_FD"; then
    echo 'ERROR: could not explicitly release deployment lock' >&2
    status=70
  fi
  exec {DEPLOY_TX_LOCK_FD}>&-
  exit "$status"
}
