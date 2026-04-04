import type { Dependency } from './types';

interface NpmLockV1Entry {
  version: string;
  dev?: boolean;
  dependencies?: Record<string, NpmLockV1Entry>;
  optional?: boolean;
}

interface NpmLockFileV1 {
  lockfileVersion: number;
  dependencies?: Record<string, NpmLockV1Entry>;
}

interface NpmLockPackageV2 {
  version?: string;
  dev?: boolean;
  optional?: boolean;
}

interface NpmLockFileV2 {
  lockfileVersion: number;
  packages?: Record<string, NpmLockPackageV2>;
}

function collectV1(deps: Record<string, NpmLockV1Entry> | undefined, devChain: boolean, out: Dependency[]): void {
  if (!deps) return;
  for (const [name, entry] of Object.entries(deps)) {
    if (!entry?.version) continue;
    const isDev = devChain || entry.dev === true;
    out.push({ name, version: entry.version, isDev });
    collectV1(entry.dependencies, isDev, out);
  }
}

/**
 * package-lock `packages` keys: `node_modules/foo`, `node_modules/a/node_modules/b`,
 * or npm workspaces: `packages/my-app/node_modules/foo`.
 */
export function pathToPackageName(lockPath: string): string | null {
  if (lockPath === '' || lockPath === '.') return null;
  const needle = '/node_modules/';
  const idx = lockPath.lastIndexOf(needle);
  if (idx >= 0) {
    const name = lockPath.slice(idx + needle.length);
    return name.length > 0 ? name : null;
  }
  if (lockPath.startsWith('node_modules/')) {
    const tail = lockPath.slice('node_modules/'.length);
    const segments = tail.split('/node_modules/');
    return segments[segments.length - 1] ?? null;
  }
  return null;
}

export function parseNpmLockfile(content: string): Dependency[] {
  const raw = JSON.parse(content) as NpmLockFileV1 | NpmLockFileV2;
  const lv = raw.lockfileVersion;
  if (typeof lv !== 'number') {
    throw new Error('package-lock.json: missing lockfileVersion');
  }

  if ('packages' in raw && raw.packages && typeof raw.packages === 'object') {
    const out: Dependency[] = [];
    for (const [path, pkg] of Object.entries(raw.packages)) {
      if (path === '' || !pkg?.version) continue;
      const name = pathToPackageName(path);
      if (!name) continue;
      out.push({
        name,
        version: pkg.version,
        isDev: pkg.dev === true,
      });
    }
    return dedupeDependencies(out);
  }

  const v1 = raw as NpmLockFileV1;
  if (!v1.dependencies) {
    return [];
  }
  const out: Dependency[] = [];
  collectV1(v1.dependencies, false, out);
  return dedupeDependencies(out);
}

/** Merge duplicate (name, version): prod wins over dev. */
export function dedupeDependencies(deps: Dependency[]): Dependency[] {
  const map = new Map<string, Dependency>();
  for (const d of deps) {
    const key = `${d.name}\0${d.version}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...d });
    } else if (prev.isDev && !d.isDev) {
      map.set(key, { ...d });
    }
  }
  return [...map.values()];
}
