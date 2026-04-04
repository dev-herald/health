import { describe, expect, it } from 'vitest';
import { healthIngestRequestSchema } from '../../schemas/ingest-body';

const emptyUnusedCode = {
  unusedDepsList: [] as string[],
  unusedFilesList: [] as string[],
  unusedTypeExportsList: [] as string[],
};

describe('healthIngestRequestSchema', () => {
  it('accepts minimal valid body', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: { unusedCode: emptyUnusedCode },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(true);
  });

  it('rejects invalid unusedFilesList (non-array)', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {
        unusedCode: {
          unusedDepsList: [],
          unusedFilesList: 'not-an-array' as unknown as string[],
          unusedTypeExportsList: [],
        },
      },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects invalid timestamp', () => {
    const raw = {
      timestamp: 'not-a-date',
      signals: { unusedCode: emptyUnusedCode },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects missing unusedCode on signals', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: {},
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects signals with empty object where unusedCode fields are missing', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      signals: { unusedCode: {} },
    };
    expect(healthIngestRequestSchema.safeParse(raw).success).toBe(false);
  });
});
