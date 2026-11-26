#!/usr/bin/env bash
# Source this from a private bootstrap file BEFORE the first write to the live site.
# Core commit: frontend validation + school redirect installation/reload succeeded.
# Maintenance after commit must fail visibly, but must NOT reverse that core commit.

deploy_site_transaction_files() {
  python3 - "$@" <<'PY'
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
p.add_argument('operation', choices=['lock', 'begin', 'checkpoint-cms', 'restore'])
p.add_argument('--site-root', default='/var/www/sgeda')
p.add_argument('--config', default='/etc/nginx/sites-available/sgeda')
p.add_argument('--enabled-config', default='/etc/nginx/sites-enabled/sgeda')
p.add_argument('--include-path', default='/etc/nginx/snippets/school-redirects.nginx.conf')
p.add_argument('--nginx-bin', default='nginx')
p.add_argument('--reload-bin', default='systemctl')
p.add_argument('--git-bin', default='git')
p.add_argument('--test-mode', action='store_true')
p.add_argument('--fixture-root')
p.add_argument('--backup')
p.add_argument('--restore-nginx', action='store_true')
a = p.parse_args()


def fail(message):
    raise RuntimeError(message)


def no_link_ancestors(path):
    for part in [path, *path.parents]:
        if part.is_symlink():
            fail('Symlink paths are not permitted: ' + str(part))


# Validate every fixture path BEFORE reading any site/config bytes or invoking commands.
paths = [Path(value) for value in (a.site_root, a.config, a.enabled_config, a.include_path)]
if not all(path.is_absolute() for path in paths):
    fail('Absolute deployment paths are required')
if a.test_mode:
    if not a.fixture_root:
        fail('Test mode requires a private fixture root')
    no_link_ancestors(Path(a.fixture_root))
    root = Path(os.path.abspath(a.fixture_root))
    no_link_ancestors(root)
    if not str(root).startswith('/tmp/seda-deploy-transaction-') or not root.is_dir():
        fail('Test mode requires an isolated /tmp/seda-deploy-transaction-* fixture')
    info = root.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        fail('Fixture root must be owned by this user with mode 0700')
    guarded = paths + [Path(a.nginx_bin), Path(a.reload_bin), Path(a.git_bin)]
    if a.backup:
        guarded.append(Path(a.backup))
    for path in guarded:
        no_link_ancestors(path)
        normalized = Path(os.path.abspath(path))
        if not path.is_absolute() or root not in normalized.parents:
            fail('Test mode cannot access production or non-fixture paths')
    # Reject all fixture symlinks, including protected paths, without reading their bytes.
    for base, dirs, files in os.walk(paths[0], followlinks=False):
        for name in dirs + files:
            if (Path(base) / name).is_symlink():
                fail('Fixture site cannot contain symlinks')
else:
    if a.fixture_root or [str(path) for path in paths] != [
        '/var/www/sgeda', '/etc/nginx/sites-available/sgeda',
        '/etc/nginx/sites-enabled/sgeda', '/etc/nginx/snippets/school-redirects.nginx.conf'
    ] or (a.nginx_bin, a.reload_bin, a.git_bin) != ('nginx', 'systemctl', 'git'):
        fail('Non-production paths/commands require explicit isolated test mode')
    no_link_ancestors(paths[0])

site, config, enabled, include = paths
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
    if config.is_symlink() or not config.is_file() or include.is_symlink():
        fail('Existing Nginx config must be a regular file; include cannot be a symlink')
    if not enabled.is_file() or enabled.resolve() != config.resolve():
        fail('Enabled Nginx config must load this exact site config')
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
        (backup / 'manifest.json').write_text(json.dumps({'paths': manifest, 'nginx': nginx}))
        print(backup)
    finally:
        os.umask(old_umask)
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
}

deploy_site_transaction_begin() {
  DEPLOY_TX_ARGS=("$@")
  local lock_file
  lock_file="$(deploy_site_transaction_files lock "${DEPLOY_TX_ARGS[@]}")" || return
  exec {DEPLOY_TX_LOCK_FD}>"$lock_file"
  flock "$DEPLOY_TX_LOCK_FD"
  DEPLOY_TX_BACKUP="$(deploy_site_transaction_files begin "${DEPLOY_TX_ARGS[@]}")" || return
  DEPLOY_TX_SITE=/var/www/sgeda
  DEPLOY_TX_CONFIG=/etc/nginx/sites-available/sgeda
  DEPLOY_TX_ENABLED=/etc/nginx/sites-enabled/sgeda
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
      --fixture-root) shift 2;;
      *) echo 'Unsupported deployment transaction option' >&2; return 1;;
    esac
  done
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
  local args=(--source "$DEPLOY_TX_SITE/data/seo/school-redirects.nginx.conf")
  if ((DEPLOY_TX_TEST_MODE)); then
    args+=(--test-mode --site-root "$DEPLOY_TX_SITE" --config "$DEPLOY_TX_CONFIG"
      --enabled-config "$DEPLOY_TX_ENABLED" --include-path "$DEPLOY_TX_INCLUDE"
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
  local status="$1" rollback_failed=0 dump
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
      if "$DEPLOY_TX_NGINX_BIN" -t && dump="$("$DEPLOY_TX_NGINX_BIN" -T)" &&
         { [[ "$dump" == *"# configuration file $DEPLOY_TX_CONFIG:"* ]] || [[ "$dump" == *"# configuration file $DEPLOY_TX_ENABLED:"* ]]; } &&
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
