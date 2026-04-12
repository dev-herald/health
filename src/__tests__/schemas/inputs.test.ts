import { describe, expect, it } from 'vitest';
import { actionInputsSchema } from '../../schemas/inputs';

const base = {
  apiKey: 'k',
  apiUrl: 'https://dev-herald.com/api/v1/health/ingest',
};

describe('actionInputsSchema', () => {
  it('accepts knip path', () => {
    const r = actionInputsSchema.safeParse({
      ...base,
      knipReportPath: 'knip.json',
    });
    expect(r.success).toBe(true);
  });

  it('accepts empty knip path', () => {
    const r = actionInputsSchema.safeParse({
      ...base,
      knipReportPath: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.knipReportPath).toBe('');
  });

  it('parses cve-detail flag', () => {
    const r = actionInputsSchema.safeParse({
      ...base,
      knipReportPath: 'x.json',
      cveDetail: 'true',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cveDetail).toBe(true);
  });

  it('rejects non-https api-url', () => {
    const r = actionInputsSchema.safeParse({
      ...base,
      knipReportPath: 'x.json',
      apiUrl: 'http://example.com/api',
    });
    expect(r.success).toBe(false);
  });

  it('accepts turbopack-bundle-stats-path', () => {
    const r = actionInputsSchema.safeParse({
      ...base,
      knipReportPath: '',
      turbopackBundleStatsPath: '.next/analyze',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.turbopackBundleStatsPath).toBe('.next/analyze');
  });
});
