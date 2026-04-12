import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'node:path';
import { buildHeaders, makeHttpRequest } from './api';
import { buildHealthIngestPayload } from './build-payload';
import { detectAdapter } from './lockfile/detect';
import { readAndValidateKnipReport } from './read-knip-files';
import { actionInputsSchema } from './schemas/inputs';
import { bundleSignalSchema, type BundleSignal } from './schemas/ingest-body';
import { parseBundleStatsInput } from './signals/bundle';
import { computeCveAggregates } from './signals/cve';
import { mapKnipReportToSignals } from './signals/knip';
import type { IngestSuccessData } from './types';

const DEFAULT_API_URL = 'https://dev-herald.com/api/v1/health/ingest';

function optionalString(v: string): string | undefined {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api-key', { required: true });
    const knipReportPathRaw = core.getInput('knip-report-path');
    const lockfilePathRaw = core.getInput('lockfile-path');
    const cveDetailRaw = core.getInput('cve-detail');
    const apiUrl = optionalString(core.getInput('api-url')) ?? DEFAULT_API_URL;

    const ctx = github.context;
    const repositoryFullName =
      optionalString(core.getInput('repository-full-name')) ??
      (ctx.repo?.owner && ctx.repo?.repo ? `${ctx.repo.owner}/${ctx.repo.repo}` : undefined);
    const commitSha =
      optionalString(core.getInput('commit-sha')) ??
      (typeof ctx.sha === 'string' && ctx.sha.length > 0 ? ctx.sha : undefined);
    const workflowRunUrl = optionalString(core.getInput('workflow-run-url'));
    const bundleStatsPathRaw = core.getInput('bundle-stats-path');

    const inputsParsed = actionInputsSchema.safeParse({
      apiKey,
      knipReportPath: knipReportPathRaw,
      lockfilePath: lockfilePathRaw,
      cveDetail: cveDetailRaw,
      apiUrl,
      repositoryFullName,
      commitSha,
      workflowRunUrl,
      bundleStatsPath: bundleStatsPathRaw,
    });

    if (!inputsParsed.success) {
      const msg = inputsParsed.error.issues.map((i) => i.message).join('\n');
      throw new Error(msg);
    }

    const v = inputsParsed.data;
    const workspaceRoot = process.env.GITHUB_WORKSPACE ?? process.cwd();

    let bundle: BundleSignal | undefined;
    if (v.bundleStatsPath.length > 0) {
      const statsPath = path.isAbsolute(v.bundleStatsPath)
        ? v.bundleStatsPath
        : path.join(workspaceRoot, v.bundleStatsPath);
      const parsed = parseBundleStatsInput(statsPath);
      const validated = bundleSignalSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(
          `Bundle stats produced invalid signal: ${validated.error.issues.map((i) => i.message).join('; ')}`
        );
      }
      bundle = validated.data;
      core.info(
        `Bundle (Next.js): routes=${bundle.routes.length} jsBytes=${bundle.jsBytes} cssBytes=${bundle.cssBytes} totalBytes=${bundle.totalBytes}`
      );
    }

    let unusedCode;
    if (v.knipReportPath.length > 0) {
      const knipReport = readAndValidateKnipReport(v.knipReportPath);
      unusedCode = mapKnipReportToSignals(knipReport);
      core.info(
        `Unused code lists: files=${unusedCode.unusedFilesList.length}, deps=${unusedCode.unusedDepsList.length}, typeExports=${unusedCode.unusedTypeExportsList.length}`
      );
    }

    let cveAgg;
    const lockOverride = v.lockfilePath.length > 0 ? v.lockfilePath : undefined;

    try {
      const detected = detectAdapter(workspaceRoot, lockOverride);
      if (!detected.adapter.supported) {
        core.warning(
          `CVE scanning does not support ${detected.adapter.pmName} yet; lockfile at ${detected.lockfilePath}. Skipping OSV. Use pnpm-lock.yaml or package-lock.json, or set lockfile-path to one of those.`
        );
      } else {
        const deps = await detected.adapter.listDeps(detected.lockfileDir, detected.lockfilePath);
        core.info(`${detected.adapter.pmName}: ${detected.lockfilePath} (${deps.length} packages)`);
        cveAgg = await computeCveAggregates(deps, {
          detail: v.cveDetail,
          pmName: detected.adapter.pmName,
          osvEcosystem: detected.adapter.osvEcosystem,
        });
        core.info(
          `CVE: prod vulnerablePackages=${cveAgg.prod.packages.length} totalVulns=${cveAgg.prod.totalVulnerabilities}; dev vulnerablePackages=${cveAgg.dev.packages.length} totalVulns=${cveAgg.dev.totalVulnerabilities}`
        );
      }
    } catch (e) {
      if (lockOverride) {
        throw e;
      }
      core.info(`CVE scan skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!unusedCode && !cveAgg && !bundle) {
      throw new Error(
        'No signals to send. Provide knip-report-path, a supported lockfile for CVE scanning, and/or bundle-stats-path (bundle analysis output).'
      );
    }

    const payload = buildHealthIngestPayload({
      unusedCode,
      cve: cveAgg,
      bundle,
      repositoryFullName: v.repositoryFullName,
      commitSha: v.commitSha,
      workflowRunUrl: v.workflowRunUrl,
    });

    core.info(`POST ${v.apiUrl}`);

    const headers = buildHeaders(v.apiKey);
    const response = await makeHttpRequest(v.apiUrl, 'POST', headers, payload as Record<string, unknown>);

    let json: unknown;
    try {
      json = JSON.parse(response.data) as unknown;
    } catch {
      json = null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const bodyPreview = response.data.slice(0, 2000);
      throw new Error(`Ingest failed (${response.statusCode}): ${bodyPreview}`);
    }

    const data =
      json &&
      typeof json === 'object' &&
      json !== null &&
      'data' in json &&
      typeof (json as { data: unknown }).data === 'object' &&
      (json as { data: unknown }).data !== null
        ? (json as { data: IngestSuccessData }).data
        : null;

    const reportId = data && typeof data.reportId === 'string' ? data.reportId : undefined;
    if (reportId) {
      core.setOutput('report-id', reportId);
    }
    core.setOutput('status', 'created');
    core.info(`Health report created${reportId ? `: ${reportId}` : ''}`);
  } catch (e) {
    core.setOutput('status', 'failed');
    if (e instanceof Error) {
      core.setFailed(e.message);
    } else {
      core.setFailed('Unknown error');
    }
  }
}

void run();
