import {
  healthIngestRequestSchema,
  type BundleSignal,
  type HealthIngestRequest,
} from './schemas/ingest-body';
import type { CveAggregates } from './signals/cve';
import type { KnipUnusedCodeLists } from './signals/knip';

export interface BuildPayloadOptions {
  unusedCode?: KnipUnusedCodeLists;
  cve?: CveAggregates;
  bundle?: BundleSignal;
  repositoryFullName?: string;
  commitSha?: string;
  workflowRunUrl?: string;
  schemaVersion?: number;
  timestamp?: string;
}

function cveToPayloadShape(c: CveAggregates): NonNullable<HealthIngestRequest['signals']['cve']> {
  return {
    lockfileType: c.lockfileType,
    prod: {
      totalVulnerabilities: c.prod.totalVulnerabilities,
      packages: c.prod.packages,
      ...(c.prod.severity ? { severity: c.prod.severity } : {}),
    },
    dev: {
      totalVulnerabilities: c.dev.totalVulnerabilities,
      packages: c.dev.packages,
      ...(c.dev.severity ? { severity: c.dev.severity } : {}),
    },
  };
}

export function buildHealthIngestPayload(options: BuildPayloadOptions): HealthIngestRequest {
  if (!options.unusedCode && !options.cve && !options.bundle) {
    throw new Error('At least one of unusedCode (Knip), cve, or bundle signals is required');
  }

  const signals: HealthIngestRequest['signals'] = {
    ...(options.unusedCode ? { unusedCode: options.unusedCode } : {}),
    ...(options.cve ? { cve: cveToPayloadShape(options.cve) } : {}),
    ...(options.bundle ? { bundle: options.bundle } : {}),
  };

  const body: HealthIngestRequest = {
    timestamp: options.timestamp ?? new Date().toISOString(),
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
