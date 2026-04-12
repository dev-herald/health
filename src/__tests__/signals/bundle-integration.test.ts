import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildHealthIngestPayload } from '../../build-payload';
import { bundleSignalSchema, healthIngestRequestSchema } from '../../schemas/ingest-body';
import { parseNextjsBundleInput } from '../../signals/bundle';

/** Turbopack: `next experimental-analyze --output` → `.next/diagnostics/analyze`. */
export const BUNDLE_EXPERIMENTAL_ANALYZE_FIXTURES = [
  { name: 'nextjs', analyzeDir: 'apps/nextjs/.next/diagnostics/analyze' },
] as const;

/** Webpack: `ANALYZE=true next build --webpack` with `@next/bundle-analyzer` + `analyzerMode: 'json'` → `.next/analyze/client.json`. */
export const WEBPACK_BUNDLE_ANALYZER_FIXTURES = [
  { name: 'nextjs-webpack', analyzeDir: 'apps/nextjs-webpack/.next/analyze' },
] as const;

function repoRoot(): string {
  return path.join(__dirname, '../../..');
}

function resolveDir(rel: string): string {
  return path.join(repoRoot(), rel);
}

function isFiniteNonNegativeInt(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

for (const fixture of BUNDLE_EXPERIMENTAL_ANALYZE_FIXTURES) {
  const analyzeDir = resolveDir(fixture.analyzeDir);
  const hasArtifacts = fs.existsSync(path.join(analyzeDir, 'data', 'routes.json'));

  describe.skipIf(!hasArtifacts)(`bundle integration: ${fixture.name} (experimental-analyze)`, () => {
    it('parseNextjsBundleInput → bundleSignalSchema → buildHealthIngestPayload', () => {
      const bundle = parseNextjsBundleInput(analyzeDir);

      const parsed = bundleSignalSchema.safeParse(bundle);
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.format())).toBe(true);

      expect(bundle.routes.length).toBeGreaterThan(0);
      expect(isFiniteNonNegativeInt(bundle.totalBytes)).toBe(true);
      expect(isFiniteNonNegativeInt(bundle.jsBytes)).toBe(true);
      expect(isFiniteNonNegativeInt(bundle.cssBytes)).toBe(true);

      for (const r of bundle.routes) {
        expect(typeof r.path).toBe('string');
        expect(r.path.length).toBeGreaterThan(0);
        expect(isFiniteNonNegativeInt(r.totalBytes)).toBe(true);
      }

      const payload = buildHealthIngestPayload({ bundle });
      const ingest = healthIngestRequestSchema.safeParse(payload);
      expect(ingest.success, ingest.success ? '' : JSON.stringify(ingest.error.format())).toBe(true);
    });
  });
}

for (const fixture of WEBPACK_BUNDLE_ANALYZER_FIXTURES) {
  const analyzeDir = resolveDir(fixture.analyzeDir);
  const hasArtifacts = fs.existsSync(path.join(analyzeDir, 'client.json'));

  describe.skipIf(!hasArtifacts)(`bundle integration: ${fixture.name} (webpack bundle-analyzer JSON)`, () => {
    it('parseNextjsBundleInput → bundleSignalSchema → buildHealthIngestPayload', () => {
      const bundle = parseNextjsBundleInput(analyzeDir);

      const parsed = bundleSignalSchema.safeParse(bundle);
      expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.format())).toBe(true);

      expect(bundle.routes.length).toBeGreaterThan(0);
      expect(isFiniteNonNegativeInt(bundle.totalBytes)).toBe(true);
      expect(isFiniteNonNegativeInt(bundle.jsBytes)).toBe(true);
      expect(isFiniteNonNegativeInt(bundle.cssBytes)).toBe(true);

      for (const r of bundle.routes) {
        expect(typeof r.path).toBe('string');
        expect(r.path.length).toBeGreaterThan(0);
        expect(isFiniteNonNegativeInt(r.totalBytes)).toBe(true);
      }

      const payload = buildHealthIngestPayload({ bundle });
      const ingest = healthIngestRequestSchema.safeParse(payload);
      expect(ingest.success, ingest.success ? '' : JSON.stringify(ingest.error.format())).toBe(true);
    });
  });
}
