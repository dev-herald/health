import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadInitiativeCounts, parseInitiativeCounts } from '../../initiatives/parse';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseInitiativeCounts', () => {
  it('accepts different metric keys per initiative, including numeric strings and zero', () => {
    const counts = parseInitiativeCounts(`
      drop-ts-ignore:
        directives: " 40 "
      old-build:
        workspaces: 0
        skipped: "3"
    `);
    expect(counts).toEqual({
      'drop-ts-ignore': { directives: 40 },
      'old-build': { workspaces: 0, skipped: 3 },
    });
  });

  it('accepts a single custom key', () => {
    expect(parseInitiativeCounts('{"legacy-sdk":{"calls":1}}')).toEqual({
      'legacy-sdk': { calls: 1 },
    });
  });

  it('rejects an empty map', () => {
    expect(() => parseInitiativeCounts('{}')).toThrow(/initiatives is empty/);
  });

  it('rejects an initiative with no metrics', () => {
    expect(() => parseInitiativeCounts('drop-ts-ignore: {}\n')).toThrow(/drop-ts-ignore has no metrics/);
  });

  it('rejects floats, negatives, and blank values', () => {
    expect(() => parseInitiativeCounts('drop-ts-ignore:\n  directives: 1.5\n')).toThrow(
      /drop-ts-ignore\.directives must be a whole number/
    );
    expect(() => parseInitiativeCounts('old-build:\n  workspaces: -1\n')).toThrow(
      /old-build\.workspaces must be a whole number/
    );
    expect(() => parseInitiativeCounts('old-build:\n  skipped: ""\n')).toThrow(
      /old-build\.skipped must be a whole number/
    );
  });

  it('rejects whitespace in a metric key', () => {
    expect(() => parseInitiativeCounts('old-build:\n  "still on webpack": 2\n')).toThrow(
      /must be non-empty and contain no whitespace/
    );
  });
});

describe('loadInitiativeCounts', () => {
  it('returns undefined when both inputs are blank', () => {
    expect(loadInitiativeCounts('   ', '')).toBeUndefined();
  });

  it('rejects both inputs at once', () => {
    expect(() => loadInitiativeCounts('legacy-sdk:\n  calls: 1\n', 'counts.json')).toThrow(
      /Set initiatives or initiatives-path, not both/
    );
  });

  it('reads a JSON file with open metric keys', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'initiatives-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'counts.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        'drop-ts-ignore': { directives: 40 },
        'old-build': { workspaces: 2 },
      })
    );
    expect(loadInitiativeCounts('', file)).toEqual({
      'drop-ts-ignore': { directives: 40 },
      'old-build': { workspaces: 2 },
    });
  });

  it('reports a missing file', () => {
    expect(() => loadInitiativeCounts('', '/tmp/does-not-exist-initiatives.json')).toThrow(
      /initiatives-path not found/
    );
  });
});
