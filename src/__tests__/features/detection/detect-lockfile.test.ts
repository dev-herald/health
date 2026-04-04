import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import { detectLockfileAtWorkspaceRoot } from '../../../features/detection/detect-lockfile';

describe('detectLockfileAtWorkspaceRoot', () => {
  it('prefers pnpm-lock.yaml over package-lock.json at repo root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'health-lock-'));
    try {
      writeFileSync(join(dir, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}');
      writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
      const r = detectLockfileAtWorkspaceRoot(dir);
      expect(r.type).toBe('pnpm');
      expect(r.path).toBe(join(dir, 'pnpm-lock.yaml'));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('uses package-lock.json when pnpm lockfile is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'health-lock-'));
    try {
      writeFileSync(join(dir, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}');
      const r = detectLockfileAtWorkspaceRoot(dir);
      expect(r.type).toBe('npm');
      expect(r.path).toBe(join(dir, 'package-lock.json'));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws when no supported lockfile exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'health-lock-'));
    try {
      writeFileSync(join(dir, 'yarn.lock'), 'empty\n');
      expect(() => detectLockfileAtWorkspaceRoot(dir)).toThrow(/No supported lockfile/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
