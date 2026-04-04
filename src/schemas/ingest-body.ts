import { z } from 'zod';

export const knipSignalsSchema = z
  .object({
    unusedFiles: z.number().int().min(0),
    unusedDependencies: z.number().int().min(0),
  })
  .passthrough();

export const cveSeverityBucketsSchema = z.object({
  critical: z.number().int().min(0),
  high: z.number().int().min(0),
  moderate: z.number().int().min(0),
  low: z.number().int().min(0),
  unknown: z.number().int().min(0),
});

export const cveDepsSignalSchema = z
  .object({
    vulnerablePackages: z.number().int().min(0),
    totalVulnerabilities: z.number().int().min(0),
    severity: cveSeverityBucketsSchema.optional(),
  })
  .passthrough();

export const cveSignalsSchema = z
  .object({
    lockfileType: z.string().min(1),
    prod: cveDepsSignalSchema,
    dev: cveDepsSignalSchema,
  })
  .passthrough();

export const healthSignalsSchema = z
  .object({
    knip: knipSignalsSchema.optional(),
    cve: cveSignalsSchema.optional(),
  })
  .passthrough()
  .refine((s) => s.knip !== undefined || s.cve !== undefined, {
    message: 'signals must include knip and/or cve',
  });

export const healthIngestRequestSchema = z
  .object({
    timestamp: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid ISO timestamp'),
    signals: healthSignalsSchema,
    schemaVersion: z.number().int().positive().optional(),
    repositoryFullName: z.string().min(1).optional(),
    commitSha: z.string().min(1).optional(),
    workflowRunUrl: z.string().min(1).optional(),
  })
  .passthrough();

export type HealthIngestRequest = z.infer<typeof healthIngestRequestSchema>;
