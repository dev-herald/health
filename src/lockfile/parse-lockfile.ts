import { readFileSync } from 'fs';
import type { Dependency } from './types';
import type { LockfileType } from './types';
import { parseNpmLockfile } from './parse-npm';
import { parsePnpmLockfile } from './parse-pnpm';

export function parseLockfile(type: LockfileType, lockfilePath: string): Dependency[] {
  const content = readFileSync(lockfilePath, 'utf8');

  switch (type) {
    case 'npm':
      return parseNpmLockfile(content);
    case 'pnpm':
      return parsePnpmLockfile(content);
    default: {
      const _x: never = type;
      throw new Error(`Unknown lockfile type: ${_x}`);
    }
  }
}
