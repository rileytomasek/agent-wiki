import type { QMDStore } from '@tobilu/qmd';
import { expect, test, vi } from 'vitest';

import { qmdSearch, searchMode } from '../src/search/qmd-search.ts';

function nativeStore() {
  return {
    search: vi.fn<QMDStore['search']>().mockResolvedValue([]),
    searchLex: vi.fn<QMDStore['searchLex']>().mockResolvedValue([]),
  };
}

test('keyword uses the native lexical path and preserves filters and limit', async () => {
  const store = nativeStore();
  const filter = { key: 'type', operator: 'eq', value: 'doc/guide' } as const;
  await qmdSearch(store, 'orchid', { mode: 'keyword', filter, limit: 3 });
  expect(store.searchLex).toHaveBeenCalledExactlyOnceWith('orchid', {
    filter,
    limit: 3,
  });
  expect(store.search).not.toHaveBeenCalled();
});

test('semantic passes only the original lexical and vector queries without reranking', async () => {
  const store = nativeStore();
  const filter = { key: 'type', operator: 'eq', value: 'doc/guide' } as const;
  const query = 'How does real-time care help "orchids"?';
  await qmdSearch(store, query, { mode: 'semantic', limit: 2, filter });
  expect(store.search).toHaveBeenCalledExactlyOnceWith({
    queries: [
      { type: 'lex', query },
      { type: 'vec', query },
    ],
    rerank: false,
    limit: 2,
    filter,
  });
  expect(store.searchLex).not.toHaveBeenCalled();
});

test('semantic folds line breaks without generating or rewriting query terms', async () => {
  const store = nativeStore();
  await qmdSearch(store, '  cold-weather\r\nplant care?\n', {
    mode: 'semantic',
  });
  expect(store.search).toHaveBeenCalledExactlyOnceWith({
    queries: [
      { type: 'lex', query: 'cold-weather plant care?' },
      { type: 'vec', query: 'cold-weather plant care?' },
    ],
    rerank: false,
  });
});

test('omitting mode and selecting hybrid preserve QMD full-pipeline defaults', async () => {
  const store = nativeStore();
  await qmdSearch(store, 'plant care', { limit: 2 });
  await qmdSearch(store, 'plant care', { mode: 'hybrid', limit: 2 });
  expect(store.search.mock.calls).toEqual([
    [{ query: 'plant care', limit: 2 }],
    [{ query: 'plant care', limit: 2 }],
  ]);
  expect(store.searchLex).not.toHaveBeenCalled();
});

test('invalid modes fail rather than silently starting expensive inference', () => {
  for (const mode of ['fast', '', null, 1]) {
    expect(() => searchMode(mode)).toThrow('Search mode must be');
  }
});
