import type { SupportedLockfileType } from '../features/detection/detect-lockfile';

/** Alias for CVE / parser codepaths (pnpm and npm only). */
export type LockfileType = SupportedLockfileType;

export interface Dependency {
  /** npm package name (scoped names include @scope/pkg) */
  name: string;
  /** Resolved semver as recorded in the lockfile */
  version: string;
  /** true if the lockfile marks the dependency as dev-only */
  isDev: boolean;
}
