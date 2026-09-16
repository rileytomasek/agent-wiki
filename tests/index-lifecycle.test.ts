import { readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexPaths } from '../src/search/index-paths.ts';
import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { inWorkspace } from './fixtures/workspace.ts';

const clock = () => new Date('2026-09-16T12:00:00Z');

test('real QMD index cycles preserve authored bytes and unchanged mirror files', async () => {
  await inWorkspace(async (fixture) => {
    const source =
      '---\ntype: doc/guide\n---\n# Orchids\n\nOrchid care.[^note]\n\n[^note]: Keep roots warm.\n';
    await fixture.write('café %20#[a].md', source);
    await fixture.write('stable.md', '# Stable\n\nCobalt notes.\n');
    const options = { embed: deferEmbeddings };
    const first = await indexWiki(fixture.root, options);
    expect(first.update).toMatchObject({ indexed: 2, removed: 0 });
    expect(first.state).toMatchObject({
      coverage: { complete: true },
      qmd: { needsEmbedding: 2 },
      lastCompletedAt: null,
    });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'café %20#[a].md'
    );
    expect(await readFile(join(fixture.root, 'café %20#[a].md'), 'utf8')).toBe(
      source
    );
    const mirror = join(indexPaths(fixture.root).mirrorPath, 'stable.md');
    const before = await stat(mirror);
    expect((await indexWiki(fixture.root, options)).update).toMatchObject({
      unchanged: 2,
      updated: 0,
    });
    expect((await stat(mirror)).mtimeMs).toBe(before.mtimeMs);
    await fixture.write('stable.md', '# Stable\n\nAmber replacement.\n');
    await fixture.write('new.md', '# New\n\nOrchid companion.\n');
    await rm(join(fixture.root, 'café %20#[a].md'));
    expect((await indexWiki(fixture.root, options)).update).toMatchObject({
      indexed: 1,
      updated: 1,
      removed: 1,
    });
    expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
    expect((await indexedHits(fixture.root, 'amber'))[0]?.path).toBe(
      'stable.md'
    );
    expect((await indexStatus(fixture.root)).currency).toBe('current');
  });
});

test('empty indexing completes normally without model work', async () => {
  await inWorkspace(async (fixture) => {
    const result = await indexWiki(fixture.root, { clock });
    expect(result.complete).toBe(true);
    expect(result.state).toMatchObject({
      textUpdatedAt: '2026-09-16T12:00:00.000Z',
      lastCompletedAt: '2026-09-16T12:00:00.000Z',
    });
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'current',
      currency: 'current',
      indexComplete: true,
      pendingEmbeddings: 0,
    });
  });
});

test('two indexed wikis keep independent stores and source identities', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('left/one.md', '# Left\n\nOrchid root.\n');
    await fixture.write('right/two.md', '# Right\n\nCobalt root.\n');
    const left = join(fixture.root, 'left');
    const right = join(fixture.root, 'right');
    await indexWiki(left, { embed: deferEmbeddings });
    await indexWiki(right, { embed: deferEmbeddings });
    expect((await indexedHits(left, 'orchid'))[0]?.path).toBe('one.md');
    expect(await indexedHits(right, 'orchid')).toEqual([]);
    expect((await indexedHits(right, 'cobalt'))[0]?.path).toBe('two.md');
  });
});
