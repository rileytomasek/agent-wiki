import { invocationDate, reviewStatus } from '../documents/dates.ts';
import { OperationError } from '../operations/errors.ts';
import { resultLimit } from '../operations/results.ts';
import { indexPaths } from './index-paths.ts';
import type { IndexStatusResult } from './index-types.ts';
import { openSearchStore } from './qmd.ts';
import { searchFilter } from './query-filters.ts';
import type {
  SearchDocument,
  SearchIndexNotice,
  WikiSearchOptions,
  WikiSearchResult,
} from './query-types.ts';
import { indexStatus } from './status.ts';
import type { SearchHit, SearchOptions } from './types.ts';

function nativeOptions(
  options: WikiSearchOptions,
  today: string
): SearchOptions {
  const filter = searchFilter(options.filters, today);
  const limit =
    options.limit === undefined ? undefined : resultLimit(options.limit);
  return {
    ...(filter === undefined ? {} : { filter }),
    ...(limit === undefined ? {} : { limit }),
  };
}

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

function indexNotice(status: IndexStatusResult): SearchIndexNotice | null {
  if (status.status === 'current' || status.status === 'absent') return null;
  return {
    status: status.status,
    message: `Search index is ${status.status}; source currency is ${status.currency}. Run wiki index to update it.`,
    recoveryCommand: 'wiki index',
    diagnostics: status.diagnostics,
  };
}

function requireIndex(status: IndexStatusResult): void {
  if (status.availability === 'absent')
    throw new OperationError(
      'search.index-missing',
      'No search index exists. Run wiki index first.'
    );
  if (status.availability === 'unknown')
    throw new OperationError(
      'search.index-unavailable',
      'The search index cannot be read. Run wiki status for details or wiki index --rebuild to recreate it.'
    );
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
