import { expect, test } from 'vitest';

import { openSearchStore } from '../src/index.ts';
import { createFixture } from './fixtures/wiki.ts';

test('native metadata filters preserve literal original paths', async () => {
  const fixture = await createFixture();
  const paths = ['space here.md', '日本語 café.md', 'symbols %20#[a]_!.md'];
  await Promise.all(
    paths.map((path) =>
      fixture.write(path, {
        type: 'doc/guide',
        about: ['projects/orchid.md'],
        stale_after: '2026-01-01',
      })
    )
  );
  await fixture.write('fresh.md', {
    type: 'doc/guide',
    stale_after: '2099-01-01',
  });
  await fixture.write('undated.md', { type: 'doc/note' });
  const store = await openSearchStore(fixture.paths);
  try {
    expect(await store.update()).toMatchObject({ indexed: 5, removed: 0 });
    const hits = await store.searchLex('orchid', {
      filter: {
        operator: 'and',
        operands: [
          { key: 'type', operator: 'eq', value: 'doc/guide' },
          { key: 'about', operator: 'eq', value: 'projects/orchid.md' },
          { key: 'stale_after', operator: 'lte', value: '2026-09-15' },
        ],
      },
    });
    expect(hits.map((hit) => hit.path).toSorted()).toEqual(paths.toSorted());
    expect(hits.every((hit) => hit.metadata['type'] === 'doc/guide')).toBe(
      true
    );
    expect(await store.status()).toMatchObject({
      totalDocuments: 5,
      needsEmbedding: 5,
      pendingMetadata: 0,
      hasVectorIndex: false,
    });
    expect(await store.searchLex('orchid', { limit: 1 })).toHaveLength(1);
  } finally {
    await store.close();
    await fixture.dispose();
  }
});

test('rejects relative locations and documents without original path metadata', async () => {
  const fixture = await createFixture();
  await expect(
    openSearchStore({ ...fixture.paths, dbPath: 'relative.sqlite' })
  ).rejects.toThrow('must be absolute');
  await expect(
    openSearchStore({ ...fixture.paths, mirrorPath: 'relative' })
  ).rejects.toThrow('must be absolute');
  await fixture.write('missing.md', { source_path: '' });
  const store = await openSearchStore(fixture.paths);
  try {
    await store.update();
    await expect(store.searchLex('orchid')).rejects.toThrow('source_path');
    await expect(
      store.search('orchid', {
        filter: { key: '', operator: 'eq', value: 'bad' },
      })
    ).rejects.toThrow('key');
  } finally {
    await store.close();
    await fixture.dispose();
  }
});
