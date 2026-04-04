import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  collectPnpmImporterProdDev,
  extractPnpmPackageKeys,
  parsePnpmLockfile,
  parsePnpmPackageKey,
} from '../../lockfile/parse-pnpm';

describe('parsePnpmPackageKey', () => {
  it('parses scoped and peer suffix', () => {
    expect(parsePnpmPackageKey('@types/node@20.1.0')).toEqual({
      name: '@types/node',
      version: '20.1.0',
    });
    expect(parsePnpmPackageKey("vitest@4.1.2(@types/node@20.19.37)")).toEqual({
      name: 'vitest',
      version: '4.1.2',
    });
  });
});

describe('parsePnpmLockfile', () => {
  it('marks prod vs dev from importers', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/pnpm-lock-mini.yaml'), 'utf8');
    const deps = parsePnpmLockfile(raw);
    const lodash = deps.find((d) => d.name === 'lodash');
    const ts = deps.find((d) => d.name === 'typescript');
    expect(lodash?.isDev).toBe(false);
    expect(ts?.isDev).toBe(true);
  });

  it('extracts package keys', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/pnpm-lock-mini.yaml'), 'utf8');
    const keys = extractPnpmPackageKeys(raw);
    expect(keys).toContain('lodash@4.17.21');
    expect(keys).toContain('typescript@5.9.3');
  });

  it('collects importer prod/dev sets', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/pnpm-lock-mini.yaml'), 'utf8');
    const { prod, dev } = collectPnpmImporterProdDev(raw);
    expect(prod.has('lodash@4.17.21')).toBe(true);
    expect(dev.has('typescript@5.9.3')).toBe(true);
  });

  it('merges multiple importers (monorepo; pnpm 9 / pnpm 10 share this lockfile shape)', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/pnpm-lock-multi-importer.yaml'), 'utf8');
    const deps = parsePnpmLockfile(raw);
    const react = deps.find((d) => d.name === 'react');
    const eslint = deps.find((d) => d.name === 'eslint');
    const turbo = deps.find((d) => d.name === 'turbo');
    expect(react?.version).toBe('18.2.0');
    expect(react?.isDev).toBe(false);
    expect(eslint?.version).toBe('8.57.0');
    expect(eslint?.isDev).toBe(true);
    expect(turbo?.version).toBe('2.8.21');
    expect(turbo?.isDev).toBe(true);
  });
});
