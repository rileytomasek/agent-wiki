import { resultLimit } from '../operations/results.ts';
import { searchMode } from './qmd-search.ts';
import { searchFilter } from './query-filters.ts';
import type { WikiSearchOptions } from './query-types.ts';
import type { SearchOptions } from './types.ts';

export function nativeOptions(
  options: WikiSearchOptions,
  today: string
): SearchOptions {
  const filter = searchFilter(options.filters, today);
  const limit =
    options.limit === undefined ? undefined : resultLimit(options.limit);
  return {
    ...(options.mode === undefined ? {} : { mode: searchMode(options.mode) }),
    ...(filter === undefined ? {} : { filter }),
    ...(limit === undefined ? {} : { limit }),
  };
}
