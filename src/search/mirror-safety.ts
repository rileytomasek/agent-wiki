import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { inspectPath } from '../workspace/io.ts';

async function visitEntries(
  root: string,
  entries: Iterator<Dirent, undefined>
): Promise<void> {
  const next = entries.next();
  if (next.done === true) return;
  const entry = next.value;
  const path = join(root, entry.name);
  if (entry.isSymbolicLink())
    throw new Error(`Refusing a symlink in the search mirror: ${path}`);
  if (!entry.isFile() && !entry.isDirectory())
    throw new Error(`Refusing a non-regular mirror entry: ${path}`);
  if (entry.isDirectory()) await verifyMirror(path);
  await visitEntries(root, entries);
}

/** QMD receives only owned regular mirror files, never authored symlink targets. */
export async function verifyMirror(root: string): Promise<void> {
  if ((await inspectPath(root))?.isDirectory() !== true)
    throw new Error(`Refusing a symlink or non-directory mirror: ${root}`);
  const entries = await readdir(root, { withFileTypes: true });
  await visitEntries(root, entries.values());
}
