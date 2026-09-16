import { readFile } from 'node:fs/promises';

import { PARSER_VERSION } from '../documents/parse.ts';
import type { Diagnostic } from '../documents/types.ts';
import { atomicWrite, cacheDirectory } from '../workspace/derived.ts';
import { DISCOVERY_VERSION } from '../workspace/discovery.ts';
import { inspectPath, operationProblem } from '../workspace/io.ts';
import { indexPaths } from './index-paths.ts';
import type { IndexState, IndexVersions } from './index-types.ts';
import { PROJECTION_VERSION, QMD_BUILD } from './projection.ts';
import { isIndexState } from './state-guards.ts';

export interface StateRead {
  readonly state: IndexState | null;
  readonly diagnostics: readonly Diagnostic[];
}

export const indexVersions: IndexVersions = {
  discovery: DISCOVERY_VERSION,
  parser: PARSER_VERSION,
  projection: PROJECTION_VERSION,
  qmd: QMD_BUILD,
};

export async function readIndexState(root: string): Promise<StateRead> {
  const path = indexPaths(root).statePath;
  try {
    if ((await cacheDirectory(root, false)) === null)
      return { state: null, diagnostics: [] };
    const info = await inspectPath(path);
    if (info === null) return { state: null, diagnostics: [] };
    if (!info.isFile()) throw new Error('Index state must be a regular file');
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isIndexState(value))
      throw new Error('Index state is invalid or incompatible');
    return { state: value, diagnostics: [] };
  } catch (error) {
    return {
      state: null,
      diagnostics: [operationProblem('index.state', path, error)],
    };
  }
}

export async function writeIndexState(
  root: string,
  state: IndexState
): Promise<void> {
  await cacheDirectory(root, true);
  await atomicWrite(indexPaths(root).statePath, `${JSON.stringify(state)}\n`);
}

export function beginState(
  previous: IndexState | null,
  at: string
): IndexState {
  if (previous !== null)
    return {
      ...previous,
      run: { startedAt: at, stage: 'refresh' },
      diagnostics: [],
    };
  return {
    version: 1,
    baseline: null,
    textUpdatedAt: null,
    lastCompletedAt: null,
    run: { startedAt: at, stage: 'refresh' },
    coverage: {
      discovered: 0,
      readable: 0,
      projected: 0,
      complete: false,
    },
    qmd: null,
    countsAt: null,
    diagnostics: [],
  };
}
