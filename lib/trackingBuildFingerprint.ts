import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIRECTORIES = ['services', 'hooks', 'lib', 'store', 'engine', 'components', 'app'];
const SOURCE_FILES = ['next.config.ts', 'package-lock.json', 'i18n/en.json'];
/** Build-time code fingerprint; excludes hidden paths and symlinks. */
export function trackingBuildFingerprint(root = process.cwd()): string {
  const hash = createHash('sha256');
  const visit = (relative: string) => {
    const directory = join(root, relative);
    if (!existsSync(directory) || !lstatSync(directory).isDirectory()) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relative, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) visit(path);
      else if (entry.isFile() && /\.(?:ts|tsx|js|json)$/.test(entry.name)) hash.update(path).update(readFileSync(join(root, path)));
    }
  };
  SOURCE_DIRECTORIES.forEach(visit);
  for (const path of SOURCE_FILES) if (existsSync(join(root, path)) && lstatSync(join(root, path)).isFile()) hash.update(path).update(readFileSync(join(root, path)));
  return hash.digest('hex');
}
