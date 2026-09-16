import { indexPaths } from '../../src/search/index-paths.ts';
import {
  readIndexState,
  writeIndexState,
} from '../../src/search/index-state.ts';
import type { IndexState, TextBaseline } from '../../src/search/index-types.ts';
import { openSearchStore } from '../../src/search/qmd.ts';
import type {
  EmbeddingResult,
  SearchHit,
  SearchStore,
} from '../../src/search/types.ts';

/** Keep real text indexing while intentionally leaving model work pending. */
export async function deferEmbeddings(
  store: SearchStore
): Promise<EmbeddingResult> {
  await store.status();
  return { docsProcessed: 0, chunksEmbedded: 0, errors: 0 };
}

export async function indexedHits(
  root: string,
  query: string
): Promise<readonly SearchHit[]> {
  const store = await openSearchStore(indexPaths(root));
  try {
    return await store.searchLex(query);
  } finally {
    await store.close();
  }
}

export async function rewriteState(
  root: string,
  change: (state: IndexState) => IndexState
): Promise<void> {
  const { state } = await readIndexState(root);
  if (state === null) throw new Error('Expected valid test index state');
  await writeIndexState(root, change(state));
}

export function requireBaseline(state: IndexState): TextBaseline {
  if (state.baseline === null) throw new Error('Expected a test text baseline');
  return state.baseline;
}
