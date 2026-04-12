import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { parsePnpmLockfile, parsePnpmPackageId } from '../../lockfile/parse-pnpm';

describe('parsePnpmPackageId', () => {
  it('splits unscoped ids', () => {
    expect(parsePnpmPackageId('lodash@4.17.21')).toEqual({
      name: 'lodash',
      version: '4.17.21',
    });
  });

  it('splits scoped ids', () => {
    expect(parsePnpmPackageId('@types/node@20.19.37')).toEqual({
      name: '@types/node',
      version: '20.19.37',
    });
  });

  it('keeps peer dependency suffix on version', () => {
    const id =
      'vitest@4.1.2(@types/node@20.19.37)(vite@8.0.3(@emnapi/core@1.9.1)(@emnapi/runtime@1.9.1)(@types/node@20.19.37))';
    const { name, version } = parsePnpmPackageId(id);
    expect(name).toBe('vitest');
    expect(version.startsWith('4.1.2(')).toBe(true);
  });
});

describe('parsePnpmLockfile', () => {
  const miniV9 = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      a:
        specifier: ^1.0.0
        version: 1.0.0
    devDependencies:
      b: 2.0.0
packages:
  a@1.0.0:
    resolution: {integrity: sha512-deadbeef}
  b@2.0.0:
    resolution: {integrity: sha512-deadbeef}
  c@3.0.0:
    resolution: {integrity: sha512-deadbeef}
snapshots:
  a@1.0.0:
    dependencies:
      c: 3.0.0
  b@2.0.0: {}
  c@3.0.0: {}
`;

  it('classifies transitive reachable only from prod as prod', () => {
    const deps = parsePnpmLockfile(miniV9);
    expect(deps.find((d) => d.name === 'a')?.isDev).toBe(false);
    expect(deps.find((d) => d.name === 'b')?.isDev).toBe(true);
    expect(deps.find((d) => d.name === 'c')?.isDev).toBe(false);
  });

  it('parses workspace pnpm-lock.yaml without throwing', () => {
    const lockPath = join(__dirname, '../../../pnpm-lock.yaml');
    const content = readFileSync(lockPath, 'utf8');
    const deps = parsePnpmLockfile(content);
    expect(deps.length).toBeGreaterThan(50);
    const vitest = deps.filter((d) => d.name === 'vitest');
    expect(vitest.length).toBeGreaterThanOrEqual(1);
    expect(vitest.every((d) => d.isDev)).toBe(true);
    const zod = deps.find((d) => d.name === 'zod');
    expect(zod?.isDev).toBe(false);
  });
});
