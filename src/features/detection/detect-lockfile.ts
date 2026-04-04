import { existsSync } from 'fs';
import { join } from 'path';

/** Lockfile formats this action resolves for CVE scanning. */
export type SupportedLockfileType = 'pnpm' | 'npm';

export interface DetectedWorkspaceLockfile {
  type: SupportedLockfileType;
  /** Absolute path to the lockfile. */
  path: string;
}

/**
 * Monorepos typically commit a single lockfile at the repository root.
 * Preference: pnpm, then npm (same file priority as most CI setups).
 */
const ROOT_LOCKFILE_PRIORITY: Array<{ file: string; type: SupportedLockfileType }> = [
  { file: 'pnpm-lock.yaml', type: 'pnpm' },
  { file: 'package-lock.json', type: 'npm' },
];

/**
 * Detect `pnpm-lock.yaml` or `package-lock.json` under the workspace root (e.g. `GITHUB_WORKSPACE`).
 * Does not walk subpackages; the root lockfile is the source of truth for resolved versions.
 */
export function detectLockfileAtWorkspaceRoot(workspaceRoot: string): DetectedWorkspaceLockfile {
  for (const { file, type } of ROOT_LOCKFILE_PRIORITY) {
    const full = join(workspaceRoot, file);
    if (existsSync(full)) {
      return { type, path: full };
    }
  }

  throw new Error(
    `No supported lockfile in ${workspaceRoot}. Add pnpm-lock.yaml or package-lock.json at the repository root.`
  );
}
