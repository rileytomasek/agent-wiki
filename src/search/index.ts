import { resolve } from 'node:path';

import { acquireWorkspaceLock } from '../workspace/write-lock.ts';
import { runIndex } from './index-run.ts';
import { readIndexState } from './index-state.ts';
import type { IndexOptions, IndexResult } from './index-types.ts';

/** Indexing is explicit; readers and status never call this coordinator. */
export async function indexWiki(
  root: string,
  options: IndexOptions = {}
): Promise<IndexResult> {
  const absolute = resolve(root);
  const lock = await acquireWorkspaceLock(absolute);
  try {
    const previous = await readIndexState(absolute);
    return await runIndex(absolute, options, previous.state);
  } finally {
    await lock.release();
  }
}
