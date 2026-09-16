import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { inspectPath } from './io.ts';

export async function ensureDirectory(path: string): Promise<void> {
  const existing = await inspectPath(path);
  if (existing === null) {
    await mkdir(path).catch(async (error: unknown) => {
      if ((await inspectPath(path))?.isDirectory() !== true) throw error;
    });
  }
  if ((await inspectPath(path))?.isDirectory() !== true) {
    throw new Error(`Refusing a symlink or non-directory cache path: ${path}`);
  }
}

async function ignoreCache(cache: string): Promise<void> {
  await writeFile(join(cache, '.gitignore'), '*\n', { flag: 'wx' }).catch(
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
        return;
      throw error;
    }
  );
}

export async function cacheDirectory(
  root: string,
  create: boolean
): Promise<string | null> {
  const absolute = resolve(root);
  if (!(await stat(absolute)).isDirectory())
    throw new Error(`Wiki root is not a directory: ${root}`);
  const marker = join(absolute, '.agent-wiki');
  if (create) await ensureDirectory(marker);
  const markerInfo = await inspectPath(marker);
  if (markerInfo === null) return null;
  if (!markerInfo.isDirectory())
    throw new Error(`Refusing a symlink or non-directory marker: ${marker}`);
  const cache = join(marker, 'cache');
  if (create) await ensureDirectory(cache);
  const cacheInfo = await inspectPath(cache);
  if (cacheInfo === null) return null;
  if (!cacheInfo.isDirectory())
    throw new Error(`Refusing a symlink or non-directory cache: ${cache}`);
  if (create) await ignoreCache(cache);
  return cache;
}

export async function atomicWrite(
  path: string,
  content: string
): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
