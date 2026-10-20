import { z } from 'zod';

const metricKeySchema = z
  .string()
  .min(1)
  .refine((s) => !/\s/.test(s), 'must be non-empty and contain no whitespace');

const wholeCountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const initiativeCountsSchema = z
  .record(metricKeySchema, z.record(metricKeySchema, wholeCountSchema))
  .superRefine((initiatives, ctx) => {
    const slugs = Object.keys(initiatives);
    if (slugs.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'initiatives is empty' });
      return;
    }
    for (const slug of slugs) {
      if (Object.keys(initiatives[slug] ?? {}).length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `initiative ${slug} has no metrics`,
          path: [slug],
        });
      }
    }
  });

export type InitiativeCounts = z.infer<typeof initiativeCountsSchema>;

export const measurementsRequestSchema = z
  .object({
    timestamp: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid ISO timestamp'),
    commitSha: z.string().min(1),
    initiatives: initiativeCountsSchema,
  })
  .strict();

export type MeasurementsRequest = z.infer<typeof measurementsRequestSchema>;

export function buildMeasurementsPayload(options: {
  timestamp: string;
  commitSha?: string;
  initiatives: InitiativeCounts;
}): MeasurementsRequest {
  if (!options.commitSha) {
    throw new Error('commit-sha is required to record initiative measurements');
  }

  const body = {
    timestamp: options.timestamp,
    commitSha: options.commitSha,
    initiatives: options.initiatives,
  };

  const parsed = measurementsRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Initiative measurements payload validation failed: ${msg}`);
  }
  return parsed.data;
}
