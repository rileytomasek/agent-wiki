import type { Dirent, Stats } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';

import type { Diagnostic } from '../documents/types.ts';

/** Reads are replaceable to exercise partial coverage without permission tricks. */
export interface WorkspaceIO {
  readonly readDirectory: (path: string) => Promise<readonly Dirent[]>;
  readonly readSource: (path: string) => Promise<string>;
}

export const filesystemIO: WorkspaceIO = {
  readDirectory: (path) => readdir(path, { withFileTypes: true }),
  readSource: (path) => readFile(path, 'utf8'),
};

export function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

export async function inspectPath(path: string): Promise<Stats | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export function operationProblem(
  code: string,
  path: string,
  error: unknown
): Diagnostic {
  const detail = error instanceof Error ? error.message : 'Unknown failure';
  return { code, path, severity: 'error', message: detail };
}
