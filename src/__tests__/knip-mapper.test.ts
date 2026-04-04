import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { knipReportSchema } from '../schemas/knip-report';
import { mapKnipReportToSignals } from '../signals/knip';

describe('mapKnipReportToSignals', () => {
  it('collects distinct unused files and dependency names from fixture', () => {
    const raw = JSON.parse(
      readFileSync(join(__dirname, 'fixtures/knip-monorepo-sample.json'), 'utf8')
    ) as unknown;
    const report = knipReportSchema.parse(raw);
    const lists = mapKnipReportToSignals(report);
    expect(lists.unusedFilesList).toHaveLength(2);
    expect(lists.unusedFilesList.sort()).toEqual(
      ['apps/web/unused.ts', 'packages/ui/pkg.ts'].sort()
    );
    expect(lists.unusedDepsList).toEqual(['lodash', 'tsx', 'date-fns']);
    expect(lists.unusedTypeExportsList).toEqual([]);
  });

  it('includes top-level files in distinct file list', () => {
    const report = knipReportSchema.parse({
      files: ['root-a.ts'],
      issues: [
        {
          file: 'apps/x.ts',
          files: [{ name: 'apps/x.ts' }],
        },
      ],
    });
    const lists = mapKnipReportToSignals(report);
    expect(lists.unusedFilesList.sort()).toEqual(['apps/x.ts', 'root-a.ts'].sort());
  });

  it('matches Knip reporter shape: unlisted/unresolved do not affect dependency lists', () => {
    const report = knipReportSchema.parse({
      issues: [
        {
          file: 'apps/web/postcss.config.mjs',
          binaries: [],
          catalog: [],
          dependencies: [],
          devDependencies: [],
          duplicates: [],
          enumMembers: [],
          exports: [],
          files: [],
          namespaceMembers: [],
          optionalPeerDependencies: [],
          types: [],
          unlisted: [{ name: 'postcss' }],
          unresolved: [],
        },
        {
          file: 'tools/typescript/nextjs.json',
          binaries: [],
          catalog: [],
          dependencies: [],
          devDependencies: [],
          duplicates: [],
          enumMembers: [],
          exports: [],
          files: [],
          namespaceMembers: [],
          optionalPeerDependencies: [],
          types: [],
          unlisted: [],
          unresolved: [{ name: 'next' }],
        },
      ],
    });
    const lists = mapKnipReportToSignals(report);
    expect(lists.unusedFilesList).toEqual([]);
    expect(lists.unusedDepsList).toEqual([]);
    expect(lists.unusedTypeExportsList).toEqual([]);
  });

  it('formats unused type exports as file:TypeName', () => {
    const report = knipReportSchema.parse({
      issues: [
        {
          file: 'src/types.ts',
          types: [{ name: 'MyType' }, { name: 'Other' }],
        },
      ],
    });
    const lists = mapKnipReportToSignals(report);
    expect(lists.unusedTypeExportsList).toEqual(['src/types.ts:MyType', 'src/types.ts:Other']);
  });
});
