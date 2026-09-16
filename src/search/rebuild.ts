import { rm } from 'node:fs/promises';

import { inspectPath } from '../workspace/io.ts';
import { indexPaths } from './index-paths.ts';

async function removeFile(path: string): Promise<void> {
  const info = await inspectPath(path);
  if (info !== null && !info.isFile())
    throw new Error(`Refusing non-file derived database path: ${path}`);
  await rm(path, { force: true });
}

export async function rebuildSearch(root: string): Promise<void> {
  const paths = indexPaths(root);
  const mirror = await inspectPath(paths.mirrorPath);
  if (mirror !== null && !mirror.isDirectory())
    throw new Error(
      `Refusing a symlink or non-directory mirror: ${paths.mirrorPath}`
    );
  await Promise.all([
    removeFile(paths.dbPath),
    removeFile(`${paths.dbPath}-wal`),
    removeFile(`${paths.dbPath}-shm`),
  ]);
  await rm(paths.mirrorPath, { recursive: true, force: true });
}
