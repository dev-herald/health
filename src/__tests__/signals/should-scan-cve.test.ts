import { describe, expect, it } from 'vitest';
import { shouldScanCve } from '../../signals/should-scan-cve';

describe('shouldScanCve', () => {
  it('skips when neither cve nor a lockfile path is set', () => {
    expect(shouldScanCve(false, '')).toBe(false);
  });

  it('scans when cve is true', () => {
    expect(shouldScanCve(true, '')).toBe(true);
  });

  it('scans when a lockfile path is set', () => {
    expect(shouldScanCve(false, 'pnpm-lock.yaml')).toBe(true);
  });
});
