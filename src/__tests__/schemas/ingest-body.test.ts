import { describe, expect, it } from 'vitest';
import { healthIngestRequestSchema } from '../../schemas/ingest-body';

describe('healthIngestRequestSchema', () => {
  it('accepts minimal valid body with knip only', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: { knip: { unusedFiles: 0, unusedDependencies: 0 } },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(true);
  });

  it('accepts cve only', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {
        cve: {
          lockfileType: 'pnpm',
          prod: { vulnerablePackages: 0, totalVulnerabilities: 0 },
          dev: { vulnerablePackages: 0, totalVulnerabilities: 0 },
        },
      },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(true);
  });

  it('accepts knip and cve together', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {
        knip: { unusedFiles: 1, unusedDependencies: 2 },
        cve: {
          lockfileType: 'npm',
          prod: { vulnerablePackages: 0, totalVulnerabilities: 0 },
          dev: { vulnerablePackages: 1, totalVulnerabilities: 3 },
        },
      },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(true);
  });

  it('accepts cve with severity breakdown', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {
        cve: {
          lockfileType: 'npm',
          prod: {
            vulnerablePackages: 1,
            totalVulnerabilities: 2,
            severity: { critical: 0, high: 1, moderate: 1, low: 0, unknown: 0 },
          },
          dev: { vulnerablePackages: 0, totalVulnerabilities: 0 },
        },
      },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(true);
  });

  it('rejects negative unusedFiles', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: { knip: { unusedFiles: -1, unusedDependencies: 0 } },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects invalid timestamp', () => {
    const raw = {
      timestamp: 'not-a-date',
      signals: { knip: { unusedFiles: 0, unusedDependencies: 0 } },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects missing both knip and cve', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {},
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });
});
