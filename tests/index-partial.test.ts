import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexPaths } from '../src/search/index-paths.ts';
import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { failDirectory, failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('partial refresh retains unreadable indexed copies and confirms deletion without parse cache', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('retained.md', '# Retained\n\nOrchid original.\n');
    await fixture.write('gone.md', '# Gone\n\nCobalt removed.\n');
    const first = await indexWiki(fixture.root, {
      embed: deferEmbeddings,
      clock: () => new Date('2026-09-15T12:00:00Z'),
    });
    await rm(join(indexPaths(fixture.root).cachePath, 'documents.json'));
    await rm(join(fixture.root, 'gone.md'));
    await fixture.write(
      'retained.md',
      '# Retained\n\nAmber unreadable edit.\n'
    );
    await fixture.write('added.md', '# Added\n\nNew violet copy.\n');
    const result = await indexWiki(fixture.root, {
      embed: deferEmbeddings,
      io: failSource('/retained.md'),
      clock: () => new Date('2026-09-16T12:00:00Z'),
    });
    expect(result.complete).toBe(false);
    expect(result.update).toMatchObject({
      indexed: 1,
      removed: 1,
      unchanged: 1,
    });
    expect(result.state.baseline).toEqual(first.state.baseline);
    expect(result.state.textUpdatedAt).toBe('2026-09-16T12:00:00.000Z');
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'retained.md'
    );
    expect((await indexedHits(fixture.root, 'violet'))[0]?.path).toBe(
      'added.md'
    );
    expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
    expect(await indexedHits(fixture.root, 'amber')).toEqual([]);
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'incomplete',
      currency: 'stale',
      lastTextUpdate: '2026-09-16T12:00:00.000Z',
    });
  });
});

test('unvisited directory prefixes retain mirror copies and never fabricate complete coverage', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('nested/retained.md', '# Retained\n\nOrchid copy.\n');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const result = await indexWiki(fixture.root, {
      embed: deferEmbeddings,
      io: failDirectory('/nested'),
    });
    expect(result.complete).toBe(false);
    expect(result.update).toMatchObject({ unchanged: 1, removed: 0 });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'nested/retained.md'
    );
  });
});

test('missing retained mirrors abort a partial update instead of deleting indexed snapshots', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('retained.md', '# Retained\n\nOrchid snapshot.\n');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    await rm(indexPaths(fixture.root).mirrorPath, { recursive: true });
    const result = await indexWiki(fixture.root, {
      embed: deferEmbeddings,
      io: failSource('/retained.md'),
    });
    expect(result).toMatchObject({ complete: false, update: null });
    expect(result.state.coverage.complete).toBe(false);
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'retained.md'
    );
  });
});
