import { describe, expect, it } from 'vitest';
import { buildHealthIngestPayload } from '../build-payload';

describe('buildHealthIngestPayload', () => {
  it('requires at least one signal', () => {
    expect(() => buildHealthIngestPayload({})).toThrow(/At least one/);
  });

  it('builds knip-only', () => {
    const p = buildHealthIngestPayload({
      knip: { unusedFiles: 1, unusedDependencies: 2 },
    });
    expect(p.signals.knip).toEqual({ unusedFiles: 1, unusedDependencies: 2 });
    expect(p.signals.cve).toBeUndefined();
  });

  it('builds cve-only', () => {
    const p = buildHealthIngestPayload({
      cve: {
        lockfileType: 'npm',
        prod: { vulnerablePackages: 0, totalVulnerabilities: 0 },
        dev: { vulnerablePackages: 1, totalVulnerabilities: 2 },
      },
    });
    expect(p.signals.cve?.dev.totalVulnerabilities).toBe(2);
    expect(p.signals.knip).toBeUndefined();
  });

  it('includes severity when present on cve', () => {
    const p = buildHealthIngestPayload({
      cve: {
        lockfileType: 'pnpm',
        prod: {
          vulnerablePackages: 1,
          totalVulnerabilities: 1,
          severity: { critical: 1, high: 0, moderate: 0, low: 0, unknown: 0 },
        },
        dev: { vulnerablePackages: 0, totalVulnerabilities: 0 },
      },
    });
    expect(p.signals.cve?.prod.severity?.critical).toBe(1);
  });
});
