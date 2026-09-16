import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { normalizeWikiPath } from '../documents/paths.ts';
import { atomicWrite, ensureDirectory } from '../workspace/derived.ts';
import { isDiscoveredPath } from '../workspace/discovery-policy.ts';
import { inspectPath } from '../workspace/io.ts';
import type { MirrorDocument } from './mirror-projection.ts';

async function directoryChain(
  current: string,
  parts: Iterator<string, undefined>
): Promise<string> {
  const next = parts.next();
  if (next.done === true) return current;
  const path = join(current, next.value);
  await ensureDirectory(path);
  return directoryChain(path, parts);
}

async function mirrorFile(root: string, path: string): Promise<string> {
  if (normalizeWikiPath(path) !== path || !isDiscoveredPath(path))
    throw new Error(`Invalid mirror document path: ${path}`);
  const parent = dirname(path);
  const parts = parent === '.' ? [] : parent.split('/');
  await directoryChain(root, parts.values());
  const file = join(root, path);
  const existing = await inspectPath(file);
  if (existing !== null && !existing.isFile())
    throw new Error(`Mirror document is not a regular file: ${path}`);
  return file;
}

export async function writeMirrorDocument(
  root: string,
  document: MirrorDocument
): Promise<void> {
  const file = await mirrorFile(root, document.path);
  const existing = await inspectPath(file);
  if (existing !== null && (await readFile(file, 'utf8')) === document.content)
    return;
  await atomicWrite(file, document.content);
}

export async function removeMirrorDocument(
  root: string,
  path: string
): Promise<void> {
  await rm(await mirrorFile(root, path), { force: true });
}
