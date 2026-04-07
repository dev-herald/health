import { z } from 'zod';
import { makeHttpRequest } from '../api';
import { osvQueryBatchResponseSchema, osvVulnDetailSchema, type OsvQueryBatchResponse } from '../schemas/cve';
import type { Dependency } from '../lockfile/types';
import type { LockfileType } from '../lockfile/types';

export const OSV_QUERY_BATCH_URL = 'https://api.osv.dev/v1/querybatch';

const DESCRIPTION_FALLBACK_MAX = 400;

export interface SeverityBuckets {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
}

export type SeverityLabel = keyof SeverityBuckets;

export interface CveVulnerabilityRef {
  id: string;
  severity?: SeverityLabel;
  description?: string;
}

export interface CvePackageSignal {
  name: string;
  version: string;
  vulnerabilities: CveVulnerabilityRef[];
}

export interface CveEnvSignal {
  totalVulnerabilities: number;
  severity?: Partial<SeverityBuckets>;
  packages: CvePackageSignal[];
}

export interface CveAggregates {
  lockfileType: LockfileType;
  prod: CveEnvSignal;
  dev: CveEnvSignal;
}

const BATCH_SIZE = 500;
const DETAIL_CONCURRENCY = 10;

const emptySeverity = (): SeverityBuckets => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  unknown: 0,
});

function parseCvssScore(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function bucketizeScore(score: number): keyof SeverityBuckets {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  if (score > 0) return 'low';
  return 'unknown';
}

function severityFromParsedDetail(d: z.infer<typeof osvVulnDetailSchema>): keyof SeverityBuckets {
  let best: number | undefined;

  if (Array.isArray(d.severity)) {
    for (const s of d.severity) {
      const sc = parseCvssScore(s.score);
      if (sc !== undefined && (best === undefined || sc > best)) best = sc;
    }
  }

  const ds = d.database_specific;
  if (best === undefined && ds && typeof ds === 'object') {
    const sev = ds['severity'];
    if (typeof sev === 'string') {
      const u = sev.toUpperCase();
      if (u === 'CRITICAL') return 'critical';
      if (u === 'HIGH') return 'high';
      if (u === 'MODERATE' || u === 'MEDIUM') return 'medium';
      if (u === 'LOW') return 'low';
    }
  }

  if (best === undefined) return 'unknown';
  return bucketizeScore(best);
}

function descriptionFromParsedDetail(d: z.infer<typeof osvVulnDetailSchema>): string | undefined {
  if (typeof d.summary === 'string') {
    const t = d.summary.trim();
    if (t.length > 0) return t;
  }
  if (typeof d.details === 'string') {
    const trimmed = d.details.trim();
    if (!trimmed) return undefined;
    const firstBlock = trimmed.split(/\n\n+/)[0]?.trim() ?? '';
    if (!firstBlock) return undefined;
    return firstBlock.length > DESCRIPTION_FALLBACK_MAX
      ? firstBlock.slice(0, DESCRIPTION_FALLBACK_MAX)
      : firstBlock;
  }
  return undefined;
}

function metadataFromDetail(detail: unknown): { severity: keyof SeverityBuckets; description?: string } {
  const parsed = osvVulnDetailSchema.safeParse(detail);
  if (!parsed.success) return { severity: 'unknown' };
  const d = parsed.data;
  const severity = severityFromParsedDetail(d);
  const description = descriptionFromParsedDetail(d);
  return description !== undefined ? { severity, description } : { severity };
}

type BatchQuery = { package: { name: string; ecosystem: string }; version: string };
type BatchQueryWithToken = BatchQuery & { page_token?: string };

async function osvQueryBatchAll(queries: BatchQuery[]): Promise<OsvQueryBatchResponse['results']> {
  const allResults: OsvQueryBatchResponse['results'] = [];

  for (let offset = 0; offset < queries.length; offset += BATCH_SIZE) {
    const slice = queries.slice(offset, offset + BATCH_SIZE);
    let merged: OsvQueryBatchResponse['results'] = [];
    let pageTokens: (string | undefined)[] | undefined = undefined;

    for (;;) {
      const reqQueries: BatchQueryWithToken[] = slice.map((q, i) =>
        pageTokens?.[i] ? { ...q, page_token: pageTokens[i]! } : q
      );

      const res = await makeHttpRequest(
        OSV_QUERY_BATCH_URL,
        'POST',
        {
          'Content-Type': 'application/json',
          'User-Agent': 'Dev-Herald-Health-Ingest-Action/1.0',
        },
        { queries: reqQueries } as Record<string, unknown>
      );

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`OSV querybatch failed (${res.statusCode}): ${res.data.slice(0, 500)}`);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(res.data) as unknown;
      } catch {
        throw new Error('OSV querybatch: invalid JSON response');
      }

      const parsed = osvQueryBatchResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error('OSV querybatch: schema validation failed');
      }

      if (!pageTokens) {
        merged = parsed.data.results.map((r) => ({
          vulns: [...(r.vulns ?? [])],
          next_page_token: r.next_page_token,
        }));
      } else {
        for (let i = 0; i < merged.length; i++) {
          const next = parsed.data.results[i]!;
          merged[i]!.vulns = [...(merged[i]!.vulns ?? []), ...(next.vulns ?? [])];
          merged[i]!.next_page_token = next.next_page_token;
        }
      }

      pageTokens = merged.map((r) => r.next_page_token);
      if (!pageTokens.some((t) => t !== undefined)) {
        break;
      }
    }

    allResults.push(...merged);
  }

  return allResults;
}

async function fetchVulnMetadataParallel(
  ids: string[]
): Promise<Map<string, { severity: keyof SeverityBuckets; description?: string }>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, { severity: keyof SeverityBuckets; description?: string }>();
  let idx = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= unique.length) return;
      const id = unique[i]!;
      const url = `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`;
      const res = await makeHttpRequest(url, 'GET', {
        'User-Agent': 'Dev-Herald-Health-Ingest-Action/1.0',
      });
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const json = JSON.parse(res.data) as unknown;
          out.set(id, metadataFromDetail(json));
        } catch {
          out.set(id, { severity: 'unknown' });
        }
      } else {
        out.set(id, { severity: 'unknown' });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(DETAIL_CONCURRENCY, unique.length) },
    () => worker()
  );
  await Promise.all(workers);
  return out;
}

export function packagesFromBatchResults(
  deps: Dependency[],
  batchResults: OsvQueryBatchResponse['results']
): CvePackageSignal[] {
  const packages: CvePackageSignal[] = [];
  for (let i = 0; i < deps.length; i++) {
    const vulns = batchResults[i]?.vulns ?? [];
    if (vulns.length === 0) continue;
    const d = deps[i]!;
    packages.push({
      name: d.name,
      version: d.version,
      vulnerabilities: vulns.map((v) => ({ id: v.id })),
    });
  }
  return packages;
}

function totalVulnCount(packages: CvePackageSignal[]): number {
  return packages.reduce((acc, p) => acc + p.vulnerabilities.length, 0);
}

function enrichPackagesWithMetadata(
  packages: CvePackageSignal[],
  meta: Map<string, { severity: keyof SeverityBuckets; description?: string }>
): void {
  for (const pkg of packages) {
    for (const vuln of pkg.vulnerabilities) {
      const m = meta.get(vuln.id);
      if (!m) {
        vuln.severity = 'unknown';
        continue;
      }
      vuln.severity = m.severity;
      if (m.description !== undefined) vuln.description = m.description;
    }
  }
}

/** Instance-based counts (same id in two packages counts twice). Omits zero buckets. */
export function sparseSeverityInstanceCounts(packages: CvePackageSignal[]): Partial<SeverityBuckets> | undefined {
  const counts = emptySeverity();
  for (const pkg of packages) {
    for (const vuln of pkg.vulnerabilities) {
      const label = vuln.severity ?? 'unknown';
      counts[label]++;
    }
  }
  const out: Partial<SeverityBuckets> = {};
  for (const k of ['critical', 'high', 'medium', 'low', 'unknown'] as const) {
    if (counts[k] > 0) out[k] = counts[k];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function computeCveAggregates(
  lockfileType: LockfileType,
  dependencies: Dependency[],
  options: { detail: boolean }
): Promise<CveAggregates> {
  const prodIdx: number[] = [];
  const devIdx: number[] = [];
  dependencies.forEach((d, i) => (d.isDev ? devIdx : prodIdx).push(i));

  const orderedDeps = [...prodIdx.map((i) => dependencies[i]!), ...devIdx.map((i) => dependencies[i]!)];

  const queries = orderedDeps.map((d) => ({
    package: { name: d.name, ecosystem: 'npm' },
    version: d.version,
  }));

  const results = await osvQueryBatchAll(queries);

  const prodResults = prodIdx.map((_, j) => results[j]!);
  const devResults = devIdx.map((_, j) => results[prodIdx.length + j]!);

  const prodDeps = prodIdx.map((i) => dependencies[i]!);
  const devDeps = devIdx.map((i) => dependencies[i]!);

  const prodPackages = packagesFromBatchResults(prodDeps, prodResults);
  const devPackages = packagesFromBatchResults(devDeps, devResults);

  let prodSeverity: Partial<SeverityBuckets> | undefined;
  let devSeverity: Partial<SeverityBuckets> | undefined;

  if (options.detail) {
    const prodIds = prodPackages.flatMap((p) => p.vulnerabilities.map((v) => v.id));
    const devIds = devPackages.flatMap((p) => p.vulnerabilities.map((v) => v.id));
    const [prodMeta, devMeta] = await Promise.all([
      prodIds.length ? fetchVulnMetadataParallel(prodIds) : Promise.resolve(new Map()),
      devIds.length ? fetchVulnMetadataParallel(devIds) : Promise.resolve(new Map()),
    ]);
    enrichPackagesWithMetadata(prodPackages, prodMeta);
    enrichPackagesWithMetadata(devPackages, devMeta);
    prodSeverity = sparseSeverityInstanceCounts(prodPackages);
    devSeverity = sparseSeverityInstanceCounts(devPackages);
  }

  return {
    lockfileType,
    prod: {
      totalVulnerabilities: totalVulnCount(prodPackages),
      packages: prodPackages,
      ...(prodSeverity ? { severity: prodSeverity } : {}),
    },
    dev: {
      totalVulnerabilities: totalVulnCount(devPackages),
      packages: devPackages,
      ...(devSeverity ? { severity: devSeverity } : {}),
    },
  };
}
