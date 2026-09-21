import type { HybridQueryResult, QMDStore, SearchResult } from '@tobilu/qmd';

import { OperationError } from '../operations/errors.ts';
import type { SearchMode, SearchOptions } from './types.ts';

/** Validate JavaScript callers too; unknown modes must not trigger hybrid inference. */
export function searchMode(mode: unknown): SearchMode {
  if (mode === undefined) return 'hybrid';
  if (mode === 'keyword' || mode === 'semantic' || mode === 'hybrid')
    return mode;
  throw new OperationError(
    'search.mode-invalid',
    'Search mode must be keyword, semantic, or hybrid'
  );
}

/** Use only native QMD retrieval and fusion; keep its query validation and limits. */
export async function qmdSearch(
  store: Pick<QMDStore, 'search' | 'searchLex'>,
  query: string,
  options: SearchOptions = {}
): Promise<readonly (SearchResult | HybridQueryResult)[]> {
  const { mode, ...native } = options;
  const selected = searchMode(mode);
  if (selected === 'keyword') return store.searchLex(query, native);
  if (selected === 'semantic') {
    const singleLine = query.replaceAll(/[\r\n]+/gu, ' ').trim();
    return store.search({
      ...native,
      queries: [
        { type: 'lex', query: singleLine },
        { type: 'vec', query: singleLine },
      ],
      rerank: false,
    });
  }
  return store.search({ ...native, query });
}
