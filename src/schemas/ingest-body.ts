import { z } from 'zod';

export const unusedCodeSchema = z.object({
  unusedDepsList: z.array(z.string()),
  unusedFilesList: z.array(z.string()),
  unusedTypeExportsList: z.array(z.string()),
});

export const healthSignalsSchema = z
  .object({
    unusedCode: unusedCodeSchema,
  })
  .passthrough();

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
