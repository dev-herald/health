import { parse as parseYaml } from 'yaml';
import type { Dependency } from './types';
import { dedupeDependencies } from './parse-npm';

interface PnpmImporter {
  /** Values are `version` strings (older lockfiles) or `{ specifier, version }` (pnpm 9+). */
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

interface PnpmSnapshot {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface PnpmLockfileDoc {
  lockfileVersion?: string | number;
  importers?: Record<string, PnpmImporter>;
  packages?: Record<string, unknown>;
  snapshots?: Record<string, PnpmSnapshot>;
}

/** Split a pnpm `packages` / `snapshots` id into npm name + version (version may include peer suffixes). */
export function parsePnpmPackageId(id: string): { name: string; version: string } {
  if (id.startsWith('@')) {
    const slash = id.indexOf('/', 1);
    if (slash === -1) {
      const at = id.lastIndexOf('@');
      return { name: id.slice(0, at), version: id.slice(at + 1) };
    }
    const verSep = id.indexOf('@', slash);
    if (verSep === -1) {
      throw new Error(`pnpm-lock.yaml: invalid package id (missing version): ${id}`);
    }
    return { name: id.slice(0, verSep), version: id.slice(verSep + 1) };
  }
  const at = id.indexOf('@');
  if (at === -1) {
    throw new Error(`pnpm-lock.yaml: invalid package id (missing @): ${id}`);
  }
  return { name: id.slice(0, at), version: id.slice(at + 1) };
}

function getChildDepEntries(
  id: string,
  snapshots: Record<string, PnpmSnapshot> | undefined,
  packages: Record<string, unknown> | undefined
): Record<string, string> {
  const snap = snapshots?.[id];
  if (snap) {
    return {
      ...(snap.dependencies ?? {}),
      ...(snap.optionalDependencies ?? {}),
    };
  }
  const pkg = packages?.[id];
  if (pkg && typeof pkg === 'object' && pkg !== null) {
    const p = pkg as Record<string, unknown>;
    const d = p.dependencies;
    const o = p.optionalDependencies;
    return {
      ...(typeof d === 'object' && d !== null ? (d as Record<string, string>) : {}),
      ...(typeof o === 'object' && o !== null ? (o as Record<string, string>) : {}),
    };
  }
  return {};
}

function depKey(name: string, version: string): string {
  return `${name}@${version}`;
}

/** Importer entries use either a bare version string or `{ specifier, version }`. */
function importerVersionSuffix(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'version' in raw) {
    const v = (raw as { version?: unknown }).version;
    if (typeof v === 'string') return v;
  }
  return null;
}

function collectFromImporterDeps(
  deps: Record<string, unknown> | undefined,
  into: Set<string>,
  pkgMap: Map<string, { name: string; version: string }>,
  snapshots: Record<string, PnpmSnapshot> | undefined,
  packages: Record<string, unknown> | undefined,
  visited: Set<string>
): void {
  if (!deps) return;
  for (const [name, raw] of Object.entries(deps)) {
    const ver = importerVersionSuffix(raw);
    if (!ver) continue;
    collectPkg(`${name}@${ver}`, into, pkgMap, snapshots, packages, visited);
  }
}

function collectPkg(
  id: string,
  into: Set<string>,
  pkgMap: Map<string, { name: string; version: string }>,
  snapshots: Record<string, PnpmSnapshot> | undefined,
  packages: Record<string, unknown> | undefined,
  visited: Set<string>
): void {
  if (visited.has(id)) return;
  visited.add(id);

  const { name, version } = parsePnpmPackageId(id);
  const key = depKey(name, version);
  into.add(key);
  pkgMap.set(key, { name, version });

  const children = getChildDepEntries(id, snapshots, packages);
  for (const [childName, childVer] of Object.entries(children)) {
    collectPkg(`${childName}@${childVer}`, into, pkgMap, snapshots, packages, visited);
  }
}

/**
 * Flatten dependencies from `pnpm-lock.yaml` for OSV (npm ecosystem).
 * Supports lockfile v9 (`snapshots` + `packages`) and older layouts with deps on `packages` entries.
 */
export function parsePnpmLockfile(content: string): Dependency[] {
  let doc: PnpmLockfileDoc;
  try {
    doc = parseYaml(content) as PnpmLockfileDoc;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`pnpm-lock.yaml: failed to parse YAML: ${msg}`);
  }

  if (!doc.importers || typeof doc.importers !== 'object') {
    throw new Error('pnpm-lock.yaml: missing importers');
  }

  const snapshots = doc.snapshots;
  const packages = doc.packages;

  const prodKeys = new Set<string>();
  const devKeys = new Set<string>();
  const pkgMap = new Map<string, { name: string; version: string }>();

  for (const ws of Object.values(doc.importers)) {
    collectFromImporterDeps(ws.dependencies, prodKeys, pkgMap, snapshots, packages, new Set());
    collectFromImporterDeps(ws.devDependencies, devKeys, pkgMap, snapshots, packages, new Set());
  }

  const out: Dependency[] = [];
  for (const key of pkgMap.keys()) {
    const pkg = pkgMap.get(key)!;
    const isDev = devKeys.has(key) && !prodKeys.has(key);
    out.push({ name: pkg.name, version: pkg.version, isDev });
  }

  return dedupeDependencies(out);
}
