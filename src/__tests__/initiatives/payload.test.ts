import { describe, expect, it } from 'vitest';
import { buildHealthIngestPayload } from '../../build-payload';
import { buildMeasurementsPayload } from '../../initiatives/payload';

const timestamp = '2026-04-02T12:00:00.000Z';

const initiatives = {
  'drop-ts-ignore': { directives: 40 },
  'old-build': { workspaces: 2, skipped: 0 },
};

describe('buildMeasurementsPayload', () => {
  it('sends only timestamp, commitSha, and the metric maps unchanged', () => {
    const body = buildMeasurementsPayload({
      timestamp,
      commitSha: 'abc123def4567890',
      initiatives,
    });
    expect(Object.keys(body).sort()).toEqual(['commitSha', 'initiatives', 'timestamp']);
    expect(body.initiatives).toEqual(initiatives);
    expect(body).not.toHaveProperty('files');
    expect(body).not.toHaveProperty('usages');
  });

  it('shares a timestamp with a health report from the same run', () => {
    const health = buildHealthIngestPayload({
      timestamp,
      unusedCode: {
        unusedDepsList: [],
        unusedFilesList: [],
        unusedTypeExportsList: [],
      },
    });
    const measured = buildMeasurementsPayload({
      timestamp,
      commitSha: 'abc123def4567890',
      initiatives: { 'legacy-sdk': { calls: 9 } },
    });
    expect(health.timestamp).toBe(measured.timestamp);
    expect(health).not.toHaveProperty('initiatives');
    expect(measured.initiatives).toEqual({ 'legacy-sdk': { calls: 9 } });
  });

  it('requires commit-sha', () => {
    expect(() =>
      buildMeasurementsPayload({
        timestamp,
        initiatives: { 'legacy-sdk': { calls: 9 } },
      })
    ).toThrow(/commit-sha is required/);
  });
});
