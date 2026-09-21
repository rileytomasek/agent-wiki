import { expect, test, vi } from 'vitest';

import { indexPaths, openSearchStore, searchWiki } from '../src/index.ts';
import { prepareSearch, searchClock, subject } from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each(['keyword', 'semantic'] as const)(
  '%s preserves filtered snapshot results and borrowed stores without models',
  async (mode) => {
    await inWorkspace(async (fixture) => {
      await prepareSearch(fixture);
      const store = await openSearchStore(indexPaths(fixture.root));
      const closed = vi.spyOn(store, 'close');
      try {
        const options = {
          store,
          mode,
          clock: searchClock,
          limit: 1,
          filters: { type: 'doc/guide', about: subject, stale: true },
        };
        const result = await searchWiki(fixture.root, 'orchid', options);
        expect(result.documents).toHaveLength(1);
        expect(result.documents[0]).toMatchObject({
          metadata: { type: 'doc/guide', about: [subject] },
          review: { stale: true },
          snippet: { source: 'index' },
        });
        expect(result.documents[0]?.snippet.text).toContain('Orchid');
        expect(result).toMatchObject({ total: null, truncated: null });
        await fixture.write('guides/old.md', '# Changed\n');
        const stale = await searchWiki(fixture.root, 'orchid', options);
        expect(stale.indexNotice?.currency).toBe('stale');
        expect(closed).not.toHaveBeenCalled();
      } finally {
        await store.close();
      }
    });
  }
);

test('semantic retains native query validation and leaves the store usable after errors', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const store = await openSearchStore(indexPaths(fixture.root));
    try {
      await Promise.all(
        ['orchid "care', 'orchid -cold'].map(async (query) => {
          await expect(
            searchWiki(fixture.root, query, { store, mode: 'semantic' })
          ).rejects.toMatchObject({ code: 'search.failed' });
        })
      );
      const result = await searchWiki(fixture.root, '"orchid"\ncare?', {
        store,
        mode: 'semantic',
      });
      expect(result.complete).toBe(true);
    } finally {
      await store.close();
    }
  });
});
