import { z } from 'zod';

const knipNamedItemSchema = z.object({ name: z.string() }).passthrough();

const knipIssueRowSchema = z
  .object({
    file: z.string(),
    files: z.array(knipNamedItemSchema).optional(),
    dependencies: z.array(knipNamedItemSchema).optional(),
    devDependencies: z.array(knipNamedItemSchema).optional(),
    types: z.array(knipNamedItemSchema).optional(),
  })
  .passthrough();

export const knipReportSchema = z
  .object({
    issues: z.array(knipIssueRowSchema),
    files: z.array(z.string()).optional(),
  })
  .passthrough();

export type KnipReport = z.infer<typeof knipReportSchema>;
export type KnipIssueRow = z.infer<typeof knipIssueRowSchema>;
