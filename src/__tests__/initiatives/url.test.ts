import { describe, expect, it } from 'vitest';
import { measurementsUrl } from '../../initiatives/url';

describe('measurementsUrl', () => {
  it('derives the measurements path from the health ingest URL', () => {
    expect(measurementsUrl('https://dev-herald.com/api/v1/health/ingest')).toBe(
      'https://dev-herald.com/api/v1/initiatives/measurements'
    );
  });

  it('keeps a custom host and drops the query string', () => {
    expect(measurementsUrl('https://staging.example.com/api/v1/health/ingest?x=1')).toBe(
      'https://staging.example.com/api/v1/initiatives/measurements'
    );
  });

  it('falls back to the standard path when ingest is not under /health/ingest', () => {
    expect(measurementsUrl('https://example.com/custom/ingest')).toBe(
      'https://example.com/api/v1/initiatives/measurements'
    );
  });
});
