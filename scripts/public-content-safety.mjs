import fs from 'node:fs';
import path from 'node:path';

// Historical policy backup, not a public route or a school migration target.
// Check the directory entry itself so even dangling symlinks cannot reintroduce it.
export const FORBIDDEN_PUBLIC_BACKUPS = Object.freeze(['aeis_backup']);

export function findPublicBackups(root = process.cwd()) {
  return FORBIDDEN_PUBLIC_BACKUPS.filter(name => {
    try {
      fs.lstatSync(path.join(root, name));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  });
}

export function assertNoPublicBackups(root = process.cwd()) {
  const found = findPublicBackups(root);
  if (found.length) {
    throw new Error(`Archived content must stay outside the public site root: ${found.map(name => `/${name}/`).join(', ')}. Move the backup out of the site before building; do not publish or submit it.`);
  }
  return true;
}
