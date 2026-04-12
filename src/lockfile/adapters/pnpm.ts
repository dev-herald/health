import { readFileSync } from 'fs';
import type { Dependency } from '../types';
import type { EcosystemAdapter } from '../adapter';
import { dedupeDependencies } from '../parse-npm';
import { parsePnpmLockfile } from '../parse-pnpm';

interface PnpmListDep {
  from?: string;
  version: string;
  resolved?: string;
  path?: string;
  dependencies?: Record<string, PnpmListDep>;
}

interface PnpmListWorkspace {
  name?: string;
  version?: string;
  path?: string;
  private?: boolean;
  dependencies?: Record<string, PnpmListDep>;
  devDependencies?: Record<string, PnpmListDep>;
}

function collectDepKeys(
  deps: Record<string, PnpmListDep> | undefined,
  into: Set<string>,
  pkgMap: Map<string, { name: string; version: string }>,
  visited: Set<string>
): void {
  if (!deps) return;
  for (const [name, dep] of Object.entries(deps)) {
    if (!dep?.version) continue;
    const key = `${name}@${dep.version}`;
    if (visited.has(key)) continue;
    visited.add(key);
    into.add(key);
    pkgMap.set(key, { name, version: dep.version });
    collectDepKeys(dep.dependencies, into, pkgMap, visited);
  }
}

/**
 * Converts `pnpm list --json` style trees into a flat `Dependency[]`.
 * Used for unit tests; production code parses `pnpm-lock.yaml` directly (see `parse-pnpm.ts`).
 *
 * Prod wins: if a package is reachable from both a `dependencies` subtree and a
 * `devDependencies` subtree (across all workspaces), it is classified as prod.
 */
export function flattenPnpmListOutput(workspaces: PnpmListWorkspace[]): Dependency[] {
  const prodKeys = new Set<string>();
  const devKeys = new Set<string>();
  const pkgMap = new Map<string, { name: string; version: string }>();

  for (const ws of workspaces) {
    collectDepKeys(ws.dependencies, prodKeys, pkgMap, new Set());
    collectDepKeys(ws.devDependencies, devKeys, pkgMap, new Set());
  }

  const out: Dependency[] = [];
  for (const [key, pkg] of pkgMap) {
    const isDev = devKeys.has(key) && !prodKeys.has(key);
    out.push({ name: pkg.name, version: pkg.version, isDev });
  }

  return dedupeDependencies(out);
}

export const pnpmAdapter: EcosystemAdapter = {
  pmName: 'pnpm',
  osvEcosystem: 'npm',
  supported: true,

  async listDeps(_lockfileDir: string, lockfilePath: string): Promise<Dependency[]> {
    // Parse the lockfile directly so CVE/OSV works without `pnpm` on PATH and without
    // `pnpm list --lockfile-only` (requires pnpm ≥ 10.23). Mirrors the npm adapter.
    const content = readFileSync(lockfilePath, 'utf8');
    return parsePnpmLockfile(content);
  },
};
