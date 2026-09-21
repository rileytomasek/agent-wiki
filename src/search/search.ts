import { invocationDate, reviewStatus } from '../documents/dates.ts';
import { OperationError } from '../operations/errors.ts';
import { indexPaths } from './index-paths.ts';
import { openSearchStore } from './qmd.ts';
import { nativeOptions } from './query-options.ts';
import type {
  SearchDocument,
  WikiSearchOptions,
  WikiSearchResult,
} from './query-types.ts';
import { indexNotice, requireIndex } from './recovery.ts';
import { indexStatus } from './status.ts';
import type { SearchHit, SearchOptions } from './types.ts';

function searchDocument(hit: SearchHit, today: string): SearchDocument {
  const deadline = hit.metadata['stale_after'];
  return {
    path: hit.path,
    title: hit.title,
    score: hit.score,
    metadata: hit.metadata,
    review: reviewStatus(
      typeof deadline === 'string' ? deadline : undefined,
      today
    ),
    snippet: { text: hit.snippet, source: 'index' },
  };
}

async function queryIndex(
  root: string,
  query: string,
  native: SearchOptions,
  options: WikiSearchOptions
): Promise<readonly SearchHit[]> {
  const store = options.store ?? (await openSearchStore(indexPaths(root)));
  try {
    return options.search === undefined
      ? await store.search(query, native)
      : await options.search(store, query, native);
  } finally {
    if (options.store === undefined) await store.close();
  }
}

/** Search only the indexed snapshot, preserving native ranking and bounded retrieval. */
export async function searchWiki(
  root: string,
  query: string,
  options: WikiSearchOptions = {}
): Promise<WikiSearchResult> {
  const today = invocationDate(options.clock);
  if (query.trim() === '')
    throw new OperationError(
      'search.query-empty',
      'Search query must not be empty'
    );
  const native = nativeOptions(options, today);
  const status = await indexStatus(root);
  requireIndex(status);
  try {
    const hits = await queryIndex(root, query, native, options);
    return {
      documents: hits.map((hit) => searchDocument(hit, today)),
      total: null,
      truncated: null,
      indexNotice: indexNotice(status),
      complete: status.complete,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OperationError(
      'search.failed',
      `Search failed: ${detail}. Run wiki status to inspect the index; wiki index updates it.`
    );
  }
}
