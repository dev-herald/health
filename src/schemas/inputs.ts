import { z } from 'zod';

const nonEmpty = z.string().min(1);

export const actionInputsSchema = z.object({
  apiKey: nonEmpty,
  knipReportPath: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.trim()),
  cveDetail: z
    .string()
    .optional()
    .default('false')
    .transform((s) => {
      const v = s.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }),
  apiUrl: z
    .string()
    .min(1)
    .url({ message: 'api-url must be a valid URL' })
    .refine((u) => u.startsWith('https://'), 'api-url must use HTTPS'),
  repositoryFullName: z.string().optional(),
  commitSha: z.string().optional(),
  workflowRunUrl: z.string().optional(),
});

export type ActionInputsValidated = z.infer<typeof actionInputsSchema>;
