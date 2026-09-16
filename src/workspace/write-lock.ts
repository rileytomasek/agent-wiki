import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { OperationError } from '../operations/errors.ts';
import { cacheDirectory } from './derived.ts';
import { inspectPath } from './io.ts';

export interface WorkspaceLock {
  readonly path: string;
  readonly release: () => Promise<void>;
}

async function lockedError(path: string): Promise<OperationError> {
  const owner =
    (await inspectPath(path))?.isFile() === true
      ? await readFile(path, 'utf8').catch(() => 'unreadable owner')
      : 'unreadable owner';
  return new OperationError(
    'workspace.locked',
    `Workspace is locked: ${path}. Owner: ${owner.trim()}. If the owner has stopped, remove this abandoned lock and retry. Existing locks are never stolen.`
  );
}

/** Cooperative writer lock. Unknown or abandoned owners require explicit cleanup. */
export async function acquireWorkspaceLock(
  root: string
): Promise<WorkspaceLock> {
  const directory = await cacheDirectory(root, true);
  if (directory === null) throw new Error('Could not create workspace cache');
  const path = join(directory, 'write.lock');
  const content = `${JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() })}\n`;
  try {
    await writeFile(path, content, { flag: 'wx' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw await lockedError(path);
    }
    throw error;
  }
  return {
    path,
    async release() {
      if (
        (await inspectPath(path))?.isFile() !== true ||
        (await readFile(path, 'utf8')) !== content
      ) {
        throw new Error(`Workspace lock ownership changed: ${path}`);
      }
      await unlink(path);
    },
  };
}
