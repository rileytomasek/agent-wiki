import { resolve } from 'node:path';

import { OperationError } from '../operations/errors.ts';
import { normalizeSelections } from '../operations/selections.ts';
import { acquireWorkspaceLock } from '../workspace/write-lock.ts';
import { databaseExists } from './index-paths.ts';
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
    if (
      previous.state === null &&
      options.selections === undefined &&
      (previous.diagnostics.length > 0 || (await databaseExists(absolute)))
    )
      throw new OperationError(
        'index.selection-unknown',
        'Saved index selections are unavailable. Pass explicit indexWiki selections ([] for the entire root) to recover without changing the intended scope.'
      );
    const selections = normalizeSelections(
      options.selections ?? previous.state?.selections ?? []
    );
    return await runIndex(absolute, { ...options, selections }, previous.state);
  } finally {
    await lock.release();
  }
}
