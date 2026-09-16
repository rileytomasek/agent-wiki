import { open } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { cacheDirectory } from '../workspace/derived.ts';
import { inspectPath } from '../workspace/io.ts';
import type { StorePaths } from './types.ts';

export interface IndexPaths extends StorePaths {
  readonly statePath: string;
  readonly cachePath: string;
}

export function indexPaths(root: string): IndexPaths {
  const cachePath = join(resolve(root), '.agent-wiki', 'cache');
  return {
    cachePath,
    dbPath: join(cachePath, 'qmd.sqlite'),
    mirrorPath: join(cachePath, 'search-documents'),
    statePath: join(cachePath, 'index-state.json'),
  };
}

export async function databaseExists(root: string): Promise<boolean> {
  if ((await cacheDirectory(root, false)) === null) return false;
  const path = indexPaths(root).dbPath;
  const info = await inspectPath(path);
  if (info === null) return false;
  if (!info.isFile())
    throw new Error(`Search database is not a regular file: ${path}`);
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(16);
    await file.read(header, 0, 16, 0);
    if (header.toString() !== 'SQLite format 3\0')
      throw new Error(
        `Search database header is invalid: ${path}. Run wiki index --rebuild to recreate derived search state.`
      );
    return true;
  } finally {
    await file.close();
  }
}
