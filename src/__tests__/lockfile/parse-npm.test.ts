import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseNpmLockfile, pathToPackageName } from '../../lockfile/parse-npm';

describe('pathToPackageName', () => {
  it('handles hoisted node_modules path', () => {
    expect(pathToPackageName('node_modules/react')).toBe('react');
    expect(pathToPackageName('node_modules/@types/node')).toBe('@types/node');
  });

  it('handles nested node_modules (nested install)', () => {
    expect(pathToPackageName('node_modules/a/node_modules/b')).toBe('b');
  });

  it('handles npm workspaces path under packages/*', () => {
    expect(pathToPackageName('packages/web/node_modules/react')).toBe('react');
    expect(pathToPackageName('packages/web/node_modules/eslint')).toBe('eslint');
    expect(pathToPackageName('packages/a/node_modules/@scope/pkg')).toBe('@scope/pkg');
  });

  it('returns null for workspace package root keys', () => {
    expect(pathToPackageName('')).toBeNull();
    expect(pathToPackageName('packages/web')).toBeNull();
  });
});

describe('parseNpmLockfile', () => {
  it('parses lockfile v3 packages with dev flag', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/package-lock-v3-mini.json'), 'utf8');
    const deps = parseNpmLockfile(raw);
    const lodash = deps.find((d) => d.name === 'lodash');
    const eslint = deps.find((d) => d.name === 'eslint');
    expect(lodash?.version).toBe('4.17.21');
    expect(lodash?.isDev).toBe(false);
    expect(eslint?.version).toBe('8.57.0');
    expect(eslint?.isDev).toBe(true);
  });

  it('parses lockfile v3 workspaces (packages/*/node_modules/*)', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/package-lock-v3-workspaces.json'), 'utf8');
    const deps = parseNpmLockfile(raw);
    const react = deps.filter((d) => d.name === 'react');
    expect(react.length).toBe(1);
    expect(react[0]!.version).toBe('18.2.0');
    expect(react[0]!.isDev).toBe(false);

    const eslint = deps.find((d) => d.name === 'eslint');
    expect(eslint?.version).toBe('8.57.0');
    expect(eslint?.isDev).toBe(true);

    const lodash = deps.find((d) => d.name === 'lodash');
    expect(lodash?.isDev).toBe(true);
  });

  it('parses lockfile v1 nested dependencies tree', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/package-lock-v1-tree.json'), 'utf8');
    const deps = parseNpmLockfile(raw);
    const once = deps.find((d) => d.name === 'once');
    const wrappy = deps.find((d) => d.name === 'wrappy');
    const eslint = deps.find((d) => d.name === 'eslint');
    expect(once?.version).toBe('1.4.0');
    expect(once?.isDev).toBe(false);
    expect(wrappy?.version).toBe('1.0.2');
    expect(wrappy?.isDev).toBe(false);
    expect(eslint?.isDev).toBe(true);
  });
});
