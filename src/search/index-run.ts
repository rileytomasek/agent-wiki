import { operationProblem } from '../workspace/io.ts';
import { databaseExists, indexPaths } from './index-paths.ts';
import { prepareIndex } from './index-prepare.ts';
import { checkpoint, indexTime, type IndexProgress } from './index-progress.ts';
import { beginState, indexVersions, writeIndexState } from './index-state.ts';
import type { IndexOptions, IndexResult, IndexState } from './index-types.ts';
import { openSearchStore } from './qmd.ts';
import type { SearchStore } from './types.ts';

async function updateText(
  progress: IndexProgress,
  store: SearchStore
): Promise<boolean> {
  progress.update = await store.update();
  const qmd = await store.status();
  const counted =
    progress.update.skipped === 0 &&
    qmd.pendingMetadata === 0 &&
    qmd.totalDocuments === progress.state.coverage.projected;
  const diagnostics = [...progress.state.diagnostics];
  if (!counted && progress.state.coverage.complete) {
    diagnostics.push(
      operationProblem(
        'index.coverage',
        '',
        new Error(
          `QMD reported ${progress.update.skipped} skipped files, ${qmd.pendingMetadata} pending metadata records and ${qmd.totalDocuments} documents for ${progress.state.coverage.projected} projected sources`
        )
      )
    );
  }
  const complete = progress.state.coverage.complete && counted;
  progress.state = {
    ...progress.state,
    qmd,
    countsAt: indexTime(progress.options),
    textUpdatedAt: indexTime(progress.options),
    diagnostics,
    coverage: { ...progress.state.coverage, complete },
  };
  return complete;
}

async function embed(
  progress: IndexProgress,
  store: SearchStore
): Promise<boolean> {
  try {
    progress.embedding = await (progress.options.embed?.(store) ??
      store.embed());
  } finally {
    progress.state = {
      ...progress.state,
      qmd: await store.status(),
      countsAt: indexTime(progress.options),
    };
  }
  const qmd = progress.state.qmd;
  if (qmd === null) throw new Error('Missing QMD status after embedding');
  const diagnostics = [...progress.state.diagnostics];
  if (progress.embedding.errors > 0 || qmd.needsEmbedding > 0) {
    diagnostics.push(
      operationProblem(
        'index.embeddings',
        '',
        new Error(
          `Embeddings remain incomplete: ${qmd.needsEmbedding} documents pending, ${progress.embedding.errors} embedding errors. Run wiki index to retry.`
        )
      )
    );
  }
  const complete =
    progress.state.coverage.complete &&
    qmd.needsEmbedding === 0 &&
    qmd.pendingMetadata === 0 &&
    progress.embedding.errors === 0;
  progress.state = { ...progress.state, diagnostics };
  return complete;
}

async function execute(progress: IndexProgress): Promise<void> {
  const sources = await prepareIndex(progress);
  await checkpoint(progress, 'update');
  await databaseExists(progress.root);
  const store = await openSearchStore(indexPaths(progress.root));
  let complete = false;
  try {
    if (await updateText(progress, store)) {
      progress.state = {
        ...progress.state,
        baseline: {
          at: indexTime(progress.options),
          selections: progress.state.selections,
          versions: indexVersions,
          sources,
        },
      };
    }
    await checkpoint(progress, 'embed');
    complete = await embed(progress, store);
  } finally {
    await store.close();
  }
  progress.state = {
    ...progress.state,
    lastCompletedAt: complete
      ? indexTime(progress.options)
      : progress.state.lastCompletedAt,
  };
  await checkpoint(progress, complete ? 'complete' : 'failed');
}

export async function runIndex(
  root: string,
  options: IndexOptions,
  previous: IndexState | null
): Promise<IndexResult> {
  const progress: IndexProgress = {
    root,
    options,
    state: beginState(previous, indexTime(options), options.selections ?? []),
    update: null,
    embedding: null,
  };
  await writeIndexState(root, progress.state);
  try {
    await execute(progress);
  } catch (error) {
    const problem = operationProblem(
      `index.${progress.state.run.stage}`,
      '',
      error
    );
    progress.state = {
      ...progress.state,
      diagnostics: [...progress.state.diagnostics, problem],
    };
    await checkpoint(progress, 'failed');
  }
  return {
    root,
    complete: progress.state.run.stage === 'complete',
    update: progress.update,
    embedding: progress.embedding,
    state: progress.state,
    diagnostics: progress.state.diagnostics,
  };
}
