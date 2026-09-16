import { refreshWorkspace } from '../workspace/snapshots.ts';
import { indexPaths } from './index-paths.ts';
import { checkpoint, type IndexProgress } from './index-progress.ts';
import type { SourceFingerprint } from './index-types.ts';
import { prepareMirror } from './mirror-projection.ts';
import { reconcileMirror } from './mirror.ts';
import { rebuildSearch } from './rebuild.ts';
import { selectWorkspace } from './selection.ts';

export async function prepareIndex(
  progress: IndexProgress
): Promise<readonly SourceFingerprint[]> {
  const { root, options } = progress;
  const workspace = selectWorkspace(
    await refreshWorkspace(
      root,
      options.io === undefined ? {} : { io: options.io }
    ),
    progress.state.selections
  );
  const prepared = prepareMirror(workspace);
  progress.state = {
    ...progress.state,
    coverage: prepared.coverage,
    diagnostics: prepared.diagnostics,
  };
  const previous = progress.state.baseline;
  const changedScope =
    previous !== null &&
    JSON.stringify(previous.selections) !==
      JSON.stringify(progress.state.selections);
  if (
    (options.rebuild === true || changedScope) &&
    !prepared.coverage.complete
  ) {
    throw new Error(
      'Rebuild or selection changes require complete selected-source and projection coverage; the existing index was preserved'
    );
  }
  await checkpoint(progress, 'mirror');
  if (options.rebuild === true) await rebuildSearch(root);
  const mirror = await reconcileMirror(
    indexPaths(root).mirrorPath,
    workspace,
    prepared,
    previous
  );
  progress.state = {
    ...progress.state,
    coverage: mirror.coverage,
    diagnostics: mirror.diagnostics,
  };
  if (!mirror.safeToUpdate)
    throw new Error(
      'The index could not safely reconcile incomplete source coverage'
    );
  return prepared.sources;
}
