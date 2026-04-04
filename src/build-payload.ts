import { healthIngestRequestSchema, type HealthIngestRequest } from './schemas/ingest-body';
import type { CveAggregates } from './signals/cve';
import type { KnipAggregates } from './signals/knip';

export interface BuildPayloadOptions {
  knip?: KnipAggregates;
  cve?: CveAggregates;
  repositoryFullName?: string;
  commitSha?: string;
  workflowRunUrl?: string;
  schemaVersion?: number;
}

function cveToPayloadShape(c: CveAggregates): HealthIngestRequest['signals']['cve'] {
  return {
    lockfileType: c.lockfileType,
    prod: {
      vulnerablePackages: c.prod.vulnerablePackages,
      totalVulnerabilities: c.prod.totalVulnerabilities,
      ...(c.prod.severity ? { severity: c.prod.severity } : {}),
    },
    dev: {
      vulnerablePackages: c.dev.vulnerablePackages,
      totalVulnerabilities: c.dev.totalVulnerabilities,
      ...(c.dev.severity ? { severity: c.dev.severity } : {}),
    },
  };
}

export function buildHealthIngestPayload(options: BuildPayloadOptions): HealthIngestRequest {
  if (!options.knip && !options.cve) {
    throw new Error('At least one of knip or cve signals is required');
  }

  const signals: HealthIngestRequest['signals'] = {
    ...(options.knip
      ? {
          knip: {
            unusedFiles: options.knip.unusedFiles,
            unusedDependencies: options.knip.unusedDependencies,
          },
        }
      : {}),
    ...(options.cve ? { cve: cveToPayloadShape(options.cve) } : {}),
  };

  const body: HealthIngestRequest = {
    timestamp: new Date().toISOString(),
    signals,
    ...(options.schemaVersion !== undefined ? { schemaVersion: options.schemaVersion } : {}),
    ...(options.repositoryFullName ? { repositoryFullName: options.repositoryFullName } : {}),
    ...(options.commitSha ? { commitSha: options.commitSha } : {}),
    ...(options.workflowRunUrl ? { workflowRunUrl: options.workflowRunUrl } : {}),
  };

  const parsed = healthIngestRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Ingest payload validation failed: ${msg}`);
  }
  return parsed.data;
}
