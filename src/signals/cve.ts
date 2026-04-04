import { makeHttpRequest } from '../api';
import {
  osvQueryBatchResponseSchema,
  osvVulnDetailSchema,
  type OsvQueryBatchResponse,
} from '../schemas/cve';
import type { LockfileType } from '../lockfile/types';
import type { Dependency } from '../lockfile/types';

export const OSV_QUERY_BATCH_URL = 'https://api.osv.dev/v1/querybatch';

export interface SeverityBuckets {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  unknown: number;
}

export interface CveDepsAggregate {
  vulnerablePackages: number;
  totalVulnerabilities: number;
  severity?: SeverityBuckets;
}

export interface CveAggregates {
  lockfileType: LockfileType;
  prod: CveDepsAggregate;
  dev: CveDepsAggregate;
}

const BATCH_SIZE = 500;
const DETAIL_CONCURRENCY = 10;

const emptySeverity = (): SeverityBuckets => ({
  critical: 0,
  high: 0,
  moderate: 0,
  low: 0,
  unknown: 0,
});

function parseCvssScore(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Map numeric CVSS / GHSA score to bucket. */
export function bucketizeScore(score: number): keyof SeverityBuckets {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'moderate';
  if (score > 0) return 'low';
  return 'unknown';
}

function severityFromDetail(detail: unknown): keyof SeverityBuckets {
  const parsed = osvVulnDetailSchema.safeParse(detail);
  if (!parsed.success) return 'unknown';
  const d = parsed.data;
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
      if (u === 'MODERATE' || u === 'MEDIUM') return 'moderate';
      if (u === 'LOW') return 'low';
    }
  }

  if (best === undefined) return 'unknown';
  return bucketizeScore(best);
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

async function fetchVulnDetailsParallel(ids: string[]): Promise<Map<string, keyof SeverityBuckets>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, keyof SeverityBuckets>();
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
          out.set(id, severityFromDetail(json));
        } catch {
          out.set(id, 'unknown');
        }
      } else {
        out.set(id, 'unknown');
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

function aggregateFromBatch(
  deps: Dependency[],
  batchResults: OsvQueryBatchResponse['results'],
  severityMap: Map<string, keyof SeverityBuckets> | undefined
): CveDepsAggregate {
  let vulnerablePackages = 0;
  let totalVulnerabilities = 0;
  const severity = severityMap ? emptySeverity() : undefined;
  const seenVulnIds = new Set<string>();

  for (let i = 0; i < deps.length; i++) {
    const row = batchResults[i];
    const vulns = row?.vulns ?? [];
    if (vulns.length === 0) continue;
    vulnerablePackages++;
    totalVulnerabilities += vulns.length;

    if (severityMap && severity) {
      for (const v of vulns) {
        if (seenVulnIds.has(v.id)) continue;
        seenVulnIds.add(v.id);
        const bucket = severityMap.get(v.id) ?? 'unknown';
        severity[bucket]++;
      }
    }
  }

  return {
    vulnerablePackages,
    totalVulnerabilities,
    ...(severity ? { severity } : {}),
  };
}

/**
 * Query OSV for all dependencies and return prod/dev CVE aggregates.
 */
export async function computeCveAggregates(
  lockfileType: LockfileType,
  dependencies: Dependency[],
  options: { detail: boolean }
): Promise<CveAggregates> {
  const prodIdx: number[] = [];
  const devIdx: number[] = [];
  dependencies.forEach((d, i) => (d.isDev ? devIdx : prodIdx).push(i));

  const orderedIdx = [...prodIdx, ...devIdx];
  const orderedDeps = orderedIdx.map((i) => dependencies[i]!);

  const queries = orderedDeps.map((d) => ({
    package: { name: d.name, ecosystem: 'npm' },
    version: d.version,
  }));

  const results = await osvQueryBatchAll(queries);

  const prodResults = prodIdx.map((_, j) => results[j]!);
  const devResults = devIdx.map((_, j) => results[prodIdx.length + j]!);

  const prodDeps = prodIdx.map((i) => dependencies[i]!);
  const devDeps = devIdx.map((i) => dependencies[i]!);

  let prodSeverityMap: Map<string, keyof SeverityBuckets> | undefined;
  let devSeverityMap: Map<string, keyof SeverityBuckets> | undefined;

  if (options.detail) {
    const prodIds = prodResults.flatMap((r) => r.vulns?.map((v) => v.id) ?? []);
    const devIds = devResults.flatMap((r) => r.vulns?.map((v) => v.id) ?? []);
    const [prodMap, devMap] = await Promise.all([
      prodIds.length ? fetchVulnDetailsParallel(prodIds) : Promise.resolve(new Map()),
      devIds.length ? fetchVulnDetailsParallel(devIds) : Promise.resolve(new Map()),
    ]);
    prodSeverityMap = prodMap;
    devSeverityMap = devMap;
  }

  return {
    lockfileType,
    prod: aggregateFromBatch(prodDeps, prodResults, prodSeverityMap),
    dev: aggregateFromBatch(devDeps, devResults, devSeverityMap),
  };
}
