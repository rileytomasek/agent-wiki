import { expect, test, vi } from 'vitest';

import { indexPaths } from '../src/search/index-paths.ts';
import { indexWiki } from '../src/search/index.ts';
import { openSearchStore } from '../src/search/qmd.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('failed embeddings preserve updated searchable text, pending work and retries', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md', '# Notes\n\nOrchid care.\n');
    const result = await indexWiki(fixture.root, {
      embed: () => Promise.reject(new Error('Embedding model failed')),
    });
    expect(result).toMatchObject({
      complete: false,
      update: { indexed: 1 },
      state: { qmd: { needsEmbedding: 1 }, lastCompletedAt: null },
    });
    expect(result.state.baseline?.sources).toHaveLength(1);
    expect(result.diagnostics).toMatchObject([
      { code: 'index.embed', message: 'Embedding model failed' },
    ]);
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'notes.md'
    );
    const retry = vi.fn<typeof deferEmbeddings>(deferEmbeddings);
    const repeated = await indexWiki(fixture.root, { embed: retry });
    expect(repeated.update).toMatchObject({ unchanged: 1 });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(repeated.state.qmd?.needsEmbedding).toBe(1);
  });
});

test('QMD update failure retains the previous complete source baseline and can retry', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md', '# Notes\n\nOrchid original.\n');
    const first = await indexWiki(fixture.root, { embed: deferEmbeddings });
    await fixture.write('notes.md', '# Notes\n\nAmber replacement.\n');
    const realStore = await openSearchStore(indexPaths(fixture.root));
    const adapter = await import('../src/search/qmd.ts');
    const opening = vi.spyOn(adapter, 'openSearchStore').mockResolvedValue({
      ...realStore,
      update: () => Promise.reject(new Error('QMD update interrupted')),
    });
    try {
      const failed = await indexWiki(fixture.root, { embed: deferEmbeddings });
      expect(failed.complete).toBe(false);
      expect(failed.state.baseline).toEqual(first.state.baseline);
      expect(failed.state.textUpdatedAt).toBe(first.state.textUpdatedAt);
      expect(failed.diagnostics).toMatchObject([{ code: 'index.update' }]);
    } finally {
      opening.mockRestore();
    }
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'notes.md'
    );
    expect(
      (await indexWiki(fixture.root, { embed: deferEmbeddings })).update
    ).toMatchObject({ updated: 1 });
    expect((await indexedHits(fixture.root, 'amber'))[0]?.path).toBe(
      'notes.md'
    );
  });
});
