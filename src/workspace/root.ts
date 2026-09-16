import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { inspectPath } from './io.ts';

export interface RootOptions {
  readonly cwd: string;
  readonly root?: string;
}

async function gitBoundary(cwd: string): Promise<string | undefined> {
  const marker = await inspectPath(join(cwd, '.git'));
  if (marker?.isDirectory() === true || marker?.isFile() === true) return cwd;
  const parent = dirname(cwd);
  return parent === cwd ? undefined : gitBoundary(parent);
}

export async function hasMarker(root: string): Promise<boolean> {
  const marker = await inspectPath(join(root, '.agent-wiki'));
  return marker?.isDirectory() === true;
}

async function nearestMarker(
  directory: string,
  boundary: string
): Promise<string | undefined> {
  if (await hasMarker(directory)) return directory;
  return directory === boundary
    ? undefined
    : nearestMarker(dirname(directory), boundary);
}

export async function resolveRoot(options: RootOptions): Promise<string> {
  const cwd = resolve(options.cwd);
  const root = options.root === undefined ? cwd : resolve(cwd, options.root);
  if (!(await stat(root)).isDirectory()) {
    throw new Error(`Wiki root is not a directory: ${root}`);
  }
  if (options.root !== undefined) return root;
  return (await nearestMarker(cwd, (await gitBoundary(cwd)) ?? cwd)) ?? cwd;
}
