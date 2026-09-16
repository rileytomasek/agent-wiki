import { expect, test, vi } from 'vitest';

import {
  indexPaths,
  indexWiki,
  openSearchStore,
  searchWiki,
} from '../src/index.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { lexicalSearch } from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('repeated high-level lexical searches reuse the caller store without opening or closing it', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    await indexWiki(fixture.root, {
      selections: ['records'],
      embed: deferEmbeddings,
    });
    const store = await openSearchStore(indexPaths(fixture.root));
    const closed = vi.spyOn(store, 'close');
    const adapter = await import('../src/search/qmd.ts');
    const opening = vi.spyOn(adapter, 'openSearchStore');
    try {
      const options = { store, search: lexicalSearch };
      const first = await searchWiki(fixture.root, 'orchid', options);
      await fixture.write('unselected.md', '# Outside\n\nOrchid outside.\n');
      const second = await searchWiki(fixture.root, 'orchid', options);
      expect(second).toEqual(first);
      expect(first.documents.map((document) => document.path)).toEqual([
        'records/one.md',
      ]);
      expect(opening).not.toHaveBeenCalled();
      expect(closed).not.toHaveBeenCalled();
    } finally {
      opening.mockRestore();
      await store.close();
    }
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

test('caller stores keep the native hybrid default and remain open after failed queries', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('one.md', '# One\n\nOrchid record.\n');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const store = await openSearchStore(indexPaths(fixture.root));
    const nativeHits = await store.searchLex('orchid');
    const hybrid = vi.spyOn(store, 'search').mockResolvedValueOnce(nativeHits);
    const closed = vi.spyOn(store, 'close');
    try {
      const result = await searchWiki(fixture.root, 'orchid', {
        store,
        limit: 2,
      });
      expect(result.documents[0]?.path).toBe('one.md');
      expect(hybrid).toHaveBeenCalledWith('orchid', { limit: 2 });
      hybrid.mockRejectedValueOnce(new Error('Native search failed'));
      await expect(
        searchWiki(fixture.root, 'orchid', { store })
      ).rejects.toMatchObject({ code: 'search.failed' });
      expect(closed).not.toHaveBeenCalled();
      expect(
        (
          await searchWiki(fixture.root, 'orchid', {
            store,
            search: lexicalSearch,
          })
        ).documents
      ).toHaveLength(1);
    } finally {
      await store.close();
    }
  });
});

test('an open store observes explicit ordinary updates and preserves stale snapshots before them', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid original.\n');
    await indexWiki(fixture.root, {
      selections: ['records'],
      embed: deferEmbeddings,
    });
    const store = await openSearchStore(indexPaths(fixture.root));
    const options = { store, search: lexicalSearch };
    try {
      await fixture.write('records/one.md', '# Record\n\nAmber replacement.\n');
      const stale = await searchWiki(fixture.root, 'orchid', options);
      expect(stale.documents).toHaveLength(1);
      expect(stale.indexNotice?.message).toContain('source currency is stale');
      expect(
        (await searchWiki(fixture.root, 'amber', options)).documents
      ).toEqual([]);
      await indexWiki(fixture.root, { embed: deferEmbeddings });
      expect(
        (await searchWiki(fixture.root, 'amber', options)).documents
      ).toHaveLength(1);
      expect(
        (await searchWiki(fixture.root, 'orchid', options)).documents
      ).toEqual([]);
    } finally {
      await store.close();
    }
  });
});
