import { expect, test, vi } from 'vitest';

import { searchFilter } from '../src/search/query-filters.ts';
import { searchWiki } from '../src/search/search.ts';
import {
  firstDocument,
  lexicalSearch,
  nativeSearch,
  prepareSearch,
  searchClock,
  searchDate,
  subject,
} from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('native exact equality, array membership and review deadline conditions combine with AND', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const search = vi.fn<typeof lexicalSearch>(lexicalSearch);
    const result = await searchWiki(fixture.root, 'orchid', {
      search,
      clock: searchClock,
      filters: {
        type: 'doc/guide',
        category: 'doc',
        name: 'guide',
        about: `./${subject}`,
        stale: true,
      },
    });
    expect(
      result.documents.map((document) => document.path).toSorted()
    ).toEqual(['guides/literal %20# café.md', 'guides/old.md']);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[2]).toEqual({
      filter: {
        operator: 'and',
        operands: [
          { key: 'type', operator: 'eq', value: 'doc/guide' },
          { key: 'category', operator: 'eq', value: 'doc' },
          { key: 'name', operator: 'eq', value: 'guide' },
          { key: 'about', operator: 'eq', value: subject },
          { key: 'stale_after', operator: 'lte', value: searchDate },
        ],
      },
    });
    expect(result.documents.every((document) => document.review.stale)).toBe(
      true
    );
    expect(result).toMatchObject({
      total: null,
      truncated: null,
      complete: true,
    });
  });
});

test('limits preserve native ranking and scores without another retrieval or post-filter pass', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const native = await nativeSearch(fixture.root, { limit: 2 });
    const search = vi.fn<typeof lexicalSearch>(lexicalSearch);
    const result = await searchWiki(fixture.root, 'orchid', {
      search,
      limit: 2,
      clock: searchClock,
    });
    expect(
      result.documents.map(({ path, score }) => ({ path, score }))
    ).toEqual(native.map(({ path, score }) => ({ path, score })));
    expect(result.documents).toHaveLength(2);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]?.[2]).toEqual({ limit: 2 });
    expect(result.total).toBeNull();
    expect(result.truncated).toBeNull();
  });
});

test('an underfilled or empty native result never claims an exhaustive total', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const search = vi.fn<typeof lexicalSearch>(lexicalSearch);
    const result = await searchWiki(fixture.root, 'orchid', {
      search,
      limit: 100,
      filters: { type: 'doc/note' },
    });
    expect(result.documents).toHaveLength(1);
    expect(result).toMatchObject({
      total: null,
      truncated: null,
      complete: true,
    });
    const empty = await searchWiki(fixture.root, 'orchid', {
      search,
      filters: { type: 'absent' },
    });
    expect(empty.documents).toEqual([]);
    expect(empty.complete).toBe(true);
    expect(search).toHaveBeenCalledTimes(2);
  });
});

test('ordinary search keeps undated and future documents and captures the review clock once', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const clock = vi.fn<typeof searchClock>(searchClock);
    const result = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
      clock,
    });
    expect(clock).toHaveBeenCalledTimes(1);
    expect(result.documents).toHaveLength(7);
    const due = firstDocument(
      result.documents.filter((document) => document.path.includes('literal'))
    );
    expect(due.review).toEqual({
      stale: true,
      deadline: searchDate,
      daysOverdue: 0,
    });
    const undated = firstDocument(
      result.documents.filter((document) => document.path.includes('undated'))
    );
    expect(undated.review).toEqual({ stale: false });
    const future = firstDocument(
      result.documents.filter((document) => document.path.includes('future'))
    );
    expect(future.review).toEqual({
      stale: false,
      deadline: '2026-09-17',
      daysOverdue: 0,
    });
  });
});

test.each([
  { type: '' },
  { category: '  ' },
  { name: '' },
  { about: '' },
  { about: '../outside.md' },
  { about: '/absolute.md' },
  { about: 'wrong.txt' },
])('invalid filters fail before opening an index: %j', (filters) => {
  expect(() => searchFilter(filters, searchDate)).toThrow(
    /filter|path|empty|reference|about/u
  );
});

test('library callers cannot silently request unsupported search path globs', () => {
  const filters = { type: 'doc/guide', path: '*.md' };
  expect(() => searchFilter(filters, searchDate)).toThrow('path globs');
});
