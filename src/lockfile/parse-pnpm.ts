import type { Dependency } from './types';
import { dedupeDependencies } from './parse-npm';

/** Strip pnpm peer suffix: `pkg@1.0.0(a@2)(b@3)` -> `pkg@1.0.0` */
export function stripPeerSuffixFromKey(key: string): string {
  const p = key.indexOf('(');
  return p >= 0 ? key.slice(0, p) : key;
}

/** Parse `name@version` from lockfile package key (after peer strip). */
export function parsePnpmPackageKey(key: string): { name: string; version: string } | null {
  const head = stripPeerSuffixFromKey(key.trim());
  const at = head.lastIndexOf('@');
  if (at <= 0 || at === head.length - 1) return null;
  const name = head.slice(0, at);
  const version = head.slice(at + 1);
  if (!name || !version) return null;
  return { name, version };
}

/** Normalize version field from importer (may include peer suffix). */
function normalizeImporterVersion(v: string): string {
  return stripPeerSuffixFromKey(v.trim());
}

/**
 * Parse `importers:` section (before `packages:`) for dependency / devDependency entries.
 * Handles pnpm v9 `specifier` + `version` blocks and legacy single-line `name: version`.
 */
export function collectPnpmImporterProdDev(content: string): { prod: Set<string>; dev: Set<string> } {
  const prod = new Set<string>();
  const dev = new Set<string>();

  const beforePackages = content.split(/^packages:\s*$/m)[0] ?? content;
  const importersChunk = beforePackages.split(/^importers:\s*$/m)[1];
  if (!importersChunk) return { prod, dev };

  const lines = importersChunk.split(/\r?\n/);

  function parseDepBlock(target: Set<string>): void {
    while (lines[i] !== undefined) {
      const line = lines[i] ?? '';
      if (line.startsWith('    ') && !line.startsWith('      ')) {
        break;
      }
      if (!line.startsWith('      ')) {
        i++;
        continue;
      }
      const nameM = line.match(/^ {6}(?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/);
      if (!nameM) {
        i++;
        continue;
      }
      const pkgName = (nameM[1] ?? nameM[2] ?? nameM[3] ?? '').trim();
      i++;
      let ver = '';
      while (lines[i] !== undefined && /^ {8}/.test(lines[i]!)) {
        const vm = lines[i]!.match(/^\s+version:\s*(.+)$/);
        if (vm) {
          let v = vm[1]!.trim();
          if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
            v = v.slice(1, -1);
          }
          ver = normalizeImporterVersion(v);
        }
        i++;
      }
      if (pkgName && ver) target.add(`${pkgName}@${ver}`);
    }
  }

  let i = 0;
  while (i < lines.length) {
    const L = lines[i] ?? '';
    if (L.match(/^ {4}dependencies:\s*$/)) {
      i++;
      parseDepBlock(prod);
      continue;
    }
    if (L.match(/^ {4}devDependencies:\s*$/)) {
      i++;
      parseDepBlock(dev);
      continue;
    }
    i++;
  }

  return { prod, dev };
}

/** Extract package keys from `packages:` section. */
export function extractPnpmPackageKeys(content: string): string[] {
  const keys: string[] = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !/^packages:\s*$/.test(lines[i] ?? '')) i++;
  if (i >= lines.length) return keys;
  i++;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (/^\S/.test(line) && line.trim().length > 0) break;
    const m = line.match(/^\s+(?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/);
    if (m) {
      const key = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (key) keys.push(key);
    }
    i++;
  }
  return keys;
}

export function parsePnpmLockfile(content: string): Dependency[] {
  const pkgKeys = extractPnpmPackageKeys(content);
  const { prod, dev } = collectPnpmImporterProdDev(content);
  const out: Dependency[] = [];

  for (const rawKey of pkgKeys) {
    const parsed = parsePnpmPackageKey(rawKey);
    if (!parsed) continue;
    const composite = `${parsed.name}@${parsed.version}`;
    const inImporter = prod.has(composite) || dev.has(composite);
    const isDev = inImporter ? !prod.has(composite) && dev.has(composite) : false;
    out.push({
      name: parsed.name,
      version: parsed.version,
      isDev,
    });
  }

  return dedupeDependencies(out);
}
