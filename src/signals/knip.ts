import type { KnipReport } from '../schemas/knip-report';

export interface KnipUnusedCodeLists {
  unusedDepsList: string[];
  unusedFilesList: string[];
  unusedTypeExportsList: string[];
}

export function mapKnipReportToSignals(report: KnipReport): KnipUnusedCodeLists {
  const filePaths = new Set<string>();

  if (Array.isArray(report.files)) {
    for (const p of report.files) {
      if (typeof p === 'string' && p.length > 0) {
        filePaths.add(p);
      }
    }
  }

  const unusedDepsList: string[] = [];
  const unusedTypeExportsList: string[] = [];

  for (const issue of report.issues) {
    if (Array.isArray(issue.files)) {
      for (const entry of issue.files) {
        if (entry && typeof entry.name === 'string' && entry.name.length > 0) {
          filePaths.add(entry.name);
        }
      }
    }
    const d = issue.dependencies;
    const dd = issue.devDependencies;
    if (Array.isArray(d)) {
      for (const dep of d) {
        if (dep && typeof dep.name === 'string' && dep.name.length > 0) {
          unusedDepsList.push(dep.name);
        }
      }
    }
    if (Array.isArray(dd)) {
      for (const dep of dd) {
        if (dep && typeof dep.name === 'string' && dep.name.length > 0) {
          unusedDepsList.push(dep.name);
        }
      }
    }
    const types = issue.types;
    if (Array.isArray(types)) {
      const issueFile = typeof issue.file === 'string' ? issue.file : '';
      for (const t of types) {
        if (t && typeof t.name === 'string' && t.name.length > 0) {
          unusedTypeExportsList.push(
            issueFile.length > 0 ? `${issueFile}:${t.name}` : t.name
          );
        }
      }
    }
  }

  return {
    unusedFilesList: [...filePaths],
    unusedDepsList,
    unusedTypeExportsList,
  };
}
