import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import {
  indexPaths,
  indexStatus,
  indexWiki,
  openSearchStore,
  type IndexState,
} from '../src/index.ts';
import {
  deferEmbeddings,
  indexedHits,
  requireBaseline,
} from './fixtures/index.ts';
import { failDirectory, failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

const selections = ['records/**/*.md'];

const stateFailures: readonly {
  readonly name: string;
  readonly replace: (path: string, state: IndexState) => Promise<void>;
}[] = [
  { name: 'missing', replace: (path) => rm(path) },
  { name: 'corrupt', replace: (path) => writeFile(path, '{broken') },
  {
    name: 'invalid-selection',
    replace: (path, state) =>
      writeFile(path, JSON.stringify({ ...state, selections: ['../outside'] })),
  },
];

test('unreadable selected sources and unvisited selected directories retain their indexed copies', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid original.\n');
    await fixture.write('outside.md', '# Outside\n\nCobalt excluded.\n');
    await indexWiki(fixture.root, { selections, embed: deferEmbeddings });
    await fixture.write('records/one.md', '# Record\n\nAmber unreadable.\n');
    const failed = await indexWiki(fixture.root, {
      io: failSource('/records/one.md'),
      embed: deferEmbeddings,
    });
    expect(failed).toMatchObject({
      complete: false,
      update: { unchanged: 1, removed: 0 },
    });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'records/one.md'
    );
    expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
    const unavailable = await indexWiki(fixture.root, {
      io: failDirectory('/records'),
      embed: deferEmbeddings,
    });
    expect(unavailable).toMatchObject({
      complete: false,
      update: { removed: 0 },
    });
    expect(
      await indexStatus(fixture.root, { io: failDirectory('/records') })
    ).toMatchObject({
      currency: 'unknown',
      complete: false,
      changes: { removed: [] },
    });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'records/one.md'
    );
  });
});

test('a scope change with incomplete selected coverage preserves the old index and retries the requested scope', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    await fixture.write('outside.md', '# Outside\n\nCobalt outside.\n');
    const first = await indexWiki(fixture.root, { embed: deferEmbeddings });
    const failed = await indexWiki(fixture.root, {
      selections,
      io: failDirectory('/records'),
      embed: deferEmbeddings,
    });
    expect(failed).toMatchObject({
      complete: false,
      update: null,
      state: { selections },
    });
    expect(failed.state.baseline).toEqual(first.state.baseline);
    expect((await indexStatus(fixture.root)).currency).toBe('unknown');
    expect((await indexedHits(fixture.root, 'cobalt'))[0]?.path).toBe(
      'outside.md'
    );
    const retry = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(retry.update).toMatchObject({ unchanged: 1, removed: 1 });
    expect(retry.state.baseline?.selections).toEqual(selections);
    expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
    expect((await indexStatus(fixture.root)).currency).toBe('current');
  });
});

test('a failed QMD update cannot declare a changed selection current even when it matches the same files', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    const first = await indexWiki(fixture.root, { embed: deferEmbeddings });
    const realStore = await openSearchStore(indexPaths(fixture.root));
    const adapter = await import('../src/search/qmd.ts');
    const opening = vi.spyOn(adapter, 'openSearchStore').mockResolvedValue({
      ...realStore,
      update: () => Promise.reject(new Error('Interrupted update')),
    });
    try {
      const failed = await indexWiki(fixture.root, {
        selections,
        embed: deferEmbeddings,
      });
      expect(failed.state.baseline).toEqual(first.state.baseline);
      expect(failed.state.selections).toEqual(selections);
      expect(await indexStatus(fixture.root)).toMatchObject({
        currency: 'unknown',
        indexComplete: false,
      });
    } finally {
      opening.mockRestore();
    }
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'records/one.md'
    );
  });
});

test('failed mirror writes during a scope change preserve the previous SQLite snapshot until retry', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid original.\n');
    await fixture.write('docs/guide.md', '# Guide\n\nAmber replacement.\n');
    const first = await indexWiki(fixture.root, {
      selections: ['records'],
      embed: deferEmbeddings,
    });
    const blocker = join(indexPaths(fixture.root).mirrorPath, 'docs');
    await writeFile(blocker, 'Blocks the new mirror directory');
    const failed = await indexWiki(fixture.root, {
      selections: ['docs'],
      embed: deferEmbeddings,
    });
    expect(failed).toMatchObject({ complete: false, update: null });
    expect(failed.state.baseline).toEqual(first.state.baseline);
    expect(failed.state.coverage.complete).toBe(false);
    expect(
      failed.diagnostics.some((problem) => problem.code === 'index.mirror')
    ).toBe(true);
    expect((await indexStatus(fixture.root)).currency).toBe('unknown');
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'records/one.md'
    );
    expect(await indexedHits(fixture.root, 'amber')).toEqual([]);
    await rm(blocker);
    const retry = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(retry.update).toMatchObject({ indexed: 1, removed: 1 });
    expect(retry.state.baseline?.selections).toEqual(['docs']);
    expect((await indexStatus(fixture.root)).currency).toBe('current');
    expect(await indexedHits(fixture.root, 'orchid')).toEqual([]);
    expect((await indexedHits(fixture.root, 'amber'))[0]?.path).toBe(
      'docs/guide.md'
    );
  });
});

test.each(stateFailures)(
  '$name saved selection cannot silently widen the existing index',
  async ({ replace }) => {
    await inWorkspace(async (fixture) => {
      await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
      await fixture.write('outside.md', '# Outside\n\nCobalt excluded.\n');
      const first = await indexWiki(fixture.root, {
        selections,
        embed: deferEmbeddings,
      });
      const statePath = indexPaths(fixture.root).statePath;
      await replace(statePath, first.state);
      await expect(
        indexWiki(fixture.root, { embed: deferEmbeddings })
      ).rejects.toMatchObject({ code: 'index.selection-unknown' });
      expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
      const recovered = await indexWiki(fixture.root, {
        selections,
        embed: deferEmbeddings,
      });
      expect(recovered.state.coverage.complete).toBe(true);
      expect(recovered.state.selections).toEqual(selections);
      expect(await indexedHits(fixture.root, 'cobalt')).toEqual([]);
    });
  }
);

test('version one index state migrates as a whole-root selection', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('one.md', '# One\n\nOrchid record.\n');
    const first = await indexWiki(fixture.root, { embed: deferEmbeddings });
    await writeFile(
      indexPaths(fixture.root).statePath,
      JSON.stringify({
        ...first.state,
        version: 1,
        selections: undefined,
        baseline: { ...requireBaseline(first.state), selections: undefined },
      })
    );
    expect(await indexStatus(fixture.root)).toMatchObject({
      currency: 'current',
      selections: [],
    });
    const repeated = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(repeated.state).toMatchObject({
      version: 2,
      selections: [],
      baseline: { selections: [] },
    });
    expect(repeated.update?.unchanged).toBe(1);
  });
});

test('invalid selections reject without changing an existing scope or authored source', async () => {
  await inWorkspace(async (fixture) => {
    const source = '# Record\n\nOrchid record.\n';
    await fixture.write('records/one.md', source);
    await indexWiki(fixture.root, { selections, embed: deferEmbeddings });
    await expect(
      indexWiki(fixture.root, { selections: ['../outside'] })
    ).rejects.toMatchObject({ code: 'selection-invalid' });
    expect((await indexStatus(fixture.root)).selections).toEqual(selections);
    expect(await readFile(join(fixture.root, 'records/one.md'), 'utf8')).toBe(
      source
    );
  });
});
