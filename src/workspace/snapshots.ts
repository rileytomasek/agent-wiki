import { createHash } from 'node:crypto';
import { posix, resolve } from 'node:path';

import { parseDocument } from '../documents/parse.ts';
import type {
  Diagnostic,
  DocumentSnapshot,
  ParsedDocument,
} from '../documents/types.ts';
import { spansFit } from './cache-document.ts';
import { readCache, writeCache } from './cache.ts';
import { confirmsAbsence, discoverWorkspace } from './discovery.ts';
import { filesystemIO, operationProblem, type WorkspaceIO } from './io.ts';
import { readFiles } from './read-files.ts';
import { readableSourcePath } from './source-path.ts';

export interface WorkspaceSnapshot {
  readonly root: string;
  readonly documents: readonly DocumentSnapshot[];
  readonly files: readonly string[];
  readonly documentPaths: readonly string[];
  /** Directory prefixes whose contents could not be established this refresh. */
  readonly unavailable: readonly string[];
  readonly problems: readonly Diagnostic[];
  readonly complete: boolean;
  readonly removed: readonly string[];
}

export interface RefreshOptions {
  readonly io?: WorkspaceIO;
}

export function hashSource(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

async function loadSnapshot(
  root: string,
  path: string,
  cache: ReadonlyMap<string, ParsedDocument>,
  io: WorkspaceIO
): Promise<DocumentSnapshot> {
  const absolute = await readableSourcePath(root, path);
  const source = await io.readSource(absolute);
  const sourceHash = hashSource(source);
  const previous = cache.get(path);
  if (
    previous?.sourceHash === sourceHash &&
    spansFit(previous, source.length)
  ) {
    return { source, document: previous };
  }
  return { source, document: parseDocument({ path, source, sourceHash }) };
}

export async function readDocument(
  root: string,
  path: string
): Promise<DocumentSnapshot> {
  const normalized = posix.normalize(path);
  if (!normalized.endsWith('.md'))
    throw new Error(`Not a Markdown document: ${path}`);
  const cache = new Map(
    (await readCache(root)).map((document) => [document.path, document])
  );
  const snapshot = await loadSnapshot(root, normalized, cache, filesystemIO);
  cache.set(normalized, snapshot.document);
  await writeCache(root, [...cache.values()]);
  return snapshot;
}

export async function refreshWorkspace(
  root: string,
  options: RefreshOptions = {}
): Promise<WorkspaceSnapshot> {
  const absoluteRoot = resolve(root);
  const io = options.io ?? filesystemIO;
  const cache = new Map(
    (await readCache(absoluteRoot)).map((document) => [document.path, document])
  );
  const inventory = await discoverWorkspace(absoluteRoot, io);
  const problems = [...inventory.problems];
  const snapshots = await readFiles(inventory.documentPaths, async (path) => {
    try {
      const snapshot = await loadSnapshot(absoluteRoot, path, cache, io);
      cache.set(path, snapshot.document);
      return snapshot;
    } catch (error) {
      problems.push(operationProblem('workspace.read', path, error));
      return null;
    }
  });
  const removed = [...cache.keys()].filter((path) =>
    confirmsAbsence(path, inventory)
  );
  for (const path of removed) cache.delete(path);
  await writeCache(
    absoluteRoot,
    [...cache.values()].toSorted((a, b) => (a.path < b.path ? -1 : 1))
  );
  return {
    root: absoluteRoot,
    documents: snapshots.filter((snapshot) => snapshot !== null),
    files: inventory.files,
    documentPaths: inventory.documentPaths,
    unavailable: inventory.unavailable,
    problems,
    complete: problems.length === 0,
    removed,
  };
}
