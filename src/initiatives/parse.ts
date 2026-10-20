import * as fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { initiativeCountsSchema, type InitiativeCounts } from './payload';

function coerceCount(slug: string, key: string, value: unknown): number {
  const where = `${slug}.${key}`;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
      throw new Error(`${where} must be a whole number`);
    }
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`${where} must be a whole number`);
    }
    const n = Number(trimmed);
    const canonical = trimmed.replace(/^0+(?=\d)/, '');
    if (!Number.isSafeInteger(n) || String(n) !== canonical) {
      throw new Error(`${where} must be a whole number`);
    }
    return n;
  }
  throw new Error(`${where} must be a whole number`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKey(kind: string, key: string): void {
  if (key.length === 0 || /\s/.test(key)) {
    throw new Error(`${kind} must be non-empty and contain no whitespace`);
  }
}

export function parseInitiativeCounts(text: string): InitiativeCounts {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`initiatives must be a map of slug to metric counts: ${detail}`);
  }

  if (!isPlainObject(raw)) {
    throw new Error('initiatives must be a map of slug to metric counts');
  }

  const coerced: Record<string, Record<string, number>> = {};
  for (const [slug, metrics] of Object.entries(raw)) {
    assertKey('initiative slug', slug);
    if (!isPlainObject(metrics)) {
      throw new Error(`initiative ${slug} must be a map of metric key to count`);
    }
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(metrics)) {
      assertKey(`metric key "${key}"`, key);
      counts[key] = coerceCount(slug, key, value);
    }
    coerced[slug] = counts;
  }

  const parsed = initiativeCountsSchema.safeParse(coerced);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(msg);
  }
  return parsed.data;
}

export function loadInitiativeCounts(inline: string, filePath: string): InitiativeCounts | undefined {
  const text = inline.trim();
  const file = filePath.trim();
  if (text.length > 0 && file.length > 0) {
    throw new Error('Set initiatives or initiatives-path, not both.');
  }
  if (text.length === 0 && file.length === 0) {
    return undefined;
  }
  if (file.length > 0) {
    if (!fs.existsSync(file)) {
      throw new Error(`initiatives-path not found: ${file}`);
    }
    return parseInitiativeCounts(fs.readFileSync(file, 'utf8'));
  }
  return parseInitiativeCounts(text);
}
