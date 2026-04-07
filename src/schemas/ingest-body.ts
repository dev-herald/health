import { z } from 'zod';

export const unusedCodeSchema = z.object({
  unusedDepsList: z.array(z.string()),
  unusedFilesList: z.array(z.string()),
  unusedTypeExportsList: z.array(z.string()),
});

export const cveSeverityBucketsSchema = z.object({
  critical: z.number().int().min(0),
  high: z.number().int().min(0),
  medium: z.number().int().min(0),
  low: z.number().int().min(0),
  unknown: z.number().int().min(0),
});

/** Aggregate counts: only non-zero buckets need to be present. */
export const cveEnvSeverityPartialSchema = cveSeverityBucketsSchema.partial();

/** Matches Dev Herald ingest: CVSS-aligned medium (not npm's "moderate"); unknown = unclassified. */
export const cveVulnSeverityLabelSchema = z.enum(['critical', 'high', 'medium', 'low', 'unknown']);

export const cveVulnerabilitySchema = z.object({
  id: z.string().min(1),
  severity: cveVulnSeverityLabelSchema.optional(),
  description: z.string().optional(),
});

export const cvePackageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  vulnerabilities: z.array(cveVulnerabilitySchema),
});

export const cveEnvSignalSchema = z.object({
  totalVulnerabilities: z.number().int().min(0),
  severity: cveEnvSeverityPartialSchema.optional(),
  packages: z.array(cvePackageSchema),
});

export const cveSignalsSchema = z
  .object({
    lockfileType: z.string().min(1),
    prod: cveEnvSignalSchema,
    dev: cveEnvSignalSchema,
  })
  .passthrough();

export const healthSignalsSchema = z
  .object({
    unusedCode: unusedCodeSchema.optional(),
    cve: cveSignalsSchema.optional(),
  })
  .passthrough()
  .refine((s) => s.unusedCode !== undefined || s.cve !== undefined, {
    message: 'signals must include unusedCode (Knip) and/or cve',
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
