import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { PARSER_VERSION } from '../documents/parse.ts';
import type { ParsedDocument } from '../documents/types.ts';
import { isParsedDocument } from './cache-document.ts';
import { arrayOf, isRecord, onlyKeys } from './cache-shapes.ts';
import { DISCOVERY_VERSION } from './discovery.ts';
import { inspectPath } from './io.ts';
import { hasMarker } from './root.ts';

const CACHE_VERSION = 1;

function cachePath(root: string): string {
  return join(root, '.agent-wiki', 'cache', 'documents.json');
}

function cachedDocuments(value: unknown): readonly ParsedDocument[] {
  if (!isRecord(value)) return [];
  if (
    !onlyKeys(value, [
      'version',
      'parserVersion',
      'discoveryVersion',
      'records',
    ])
  )
    return [];
  if (
    value['version'] !== CACHE_VERSION ||
    value['parserVersion'] !== PARSER_VERSION
  )
    return [];
  if (value['discoveryVersion'] !== DISCOVERY_VERSION) return [];
  return arrayOf(value['records'], isParsedDocument) ? value['records'] : [];
}

export async function readCache(
  root: string
): Promise<readonly ParsedDocument[]> {
  try {
    if (!(await hasMarker(root))) return [];
    const cacheDirectory = await inspectPath(dirname(cachePath(root)));
    if (cacheDirectory?.isDirectory() !== true) return [];
    const cacheFile = await inspectPath(cachePath(root));
    if (cacheFile?.isFile() !== true) return [];
    const value: unknown = JSON.parse(await readFile(cachePath(root), 'utf8'));
    return cachedDocuments(value);
  } catch {
    return [];
  }
}

export async function writeCache(
  root: string,
  records: readonly ParsedDocument[]
): Promise<void> {
  const path = cachePath(root);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    if (!(await hasMarker(root))) return;
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    if ((await inspectPath(directory))?.isDirectory() !== true) return;
    const cache = {
      version: CACHE_VERSION,
      parserVersion: PARSER_VERSION,
      discoveryVersion: DISCOVERY_VERSION,
      records,
    };
    await writeFile(temporary, `${JSON.stringify(cache)}\n`, { flag: 'wx' });
    await rename(temporary, path);
  } catch {
    // Persistence is an optional optimization, never a prerequisite for reads.
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
