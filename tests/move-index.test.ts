import { expect, test } from 'vitest';

import { moveDocument } from '../src/operations/move.ts';
import { showDocument } from '../src/operations/show.ts';
import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import { acquireWorkspaceLock } from '../src/workspace/write-lock.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('moves and indexing share one exclusive workspace lock including dry-runs', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md');
    const lock = await acquireWorkspaceLock(root);
    try {
      await expect(
        moveDocument(root, 'a.md', 'new.md', { dryRun: true })
      ).rejects.toThrow('Workspace is locked');
      await expect(indexWiki(root, { embed: deferEmbeddings })).rejects.toThrow(
        'Workspace is locked'
      );
    } finally {
      await lock.release();
    }
    expect(
      (await moveDocument(root, 'a.md', 'new.md', { dryRun: true })).complete
    ).toBe(true);
  });
});

test('current reads see moved sources while search remains the explicit indexed snapshot', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('old.md', '# Orchid\n\nOrchid care instructions.\n');
    await indexWiki(root, { embed: deferEmbeddings });
    expect((await indexStatus(root)).currency).toBe('current');
    await moveDocument(root, 'old.md', 'new.md');
    expect((await showDocument(root, 'new.md')).document.path).toBe('new.md');
    await expect(showDocument(root, 'old.md')).rejects.toThrow(
      'No document path'
    );
    const state = await indexStatus(root);
    expect(state.currency).toBe('stale');
    expect(state.changes).toEqual({
      added: ['new.md'],
      changed: [],
      removed: ['old.md'],
    });
    expect((await indexedHits(root, 'Orchid'))[0]?.path).toBe('old.md');
    await indexWiki(root, { embed: deferEmbeddings });
    expect((await indexedHits(root, 'Orchid'))[0]?.path).toBe('new.md');
    expect((await indexStatus(root)).currency).toBe('current');
  });
});
