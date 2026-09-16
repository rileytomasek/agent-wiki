import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexPaths } from '../src/search/index-paths.ts';
import type { IndexStage } from '../src/search/index-types.ts';
import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import {
  deferEmbeddings,
  indexedHits,
  rewriteState,
} from './fixtures/index.ts';
import { failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

const stages: readonly IndexStage[] = ['refresh', 'mirror', 'update', 'embed'];

test.each(stages)(
  'an interrupted %s checkpoint remains incomplete until an explicit retry',
  async (stage) => {
    await inWorkspace(async (fixture) => {
      await indexWiki(fixture.root);
      await rewriteState(fixture.root, (state) => ({
        ...state,
        run: { ...state.run, stage },
      }));
      expect(await indexStatus(fixture.root)).toMatchObject({
        status: 'incomplete',
        indexComplete: false,
      });
      expect((await indexWiki(fixture.root)).complete).toBe(true);
      expect((await indexStatus(fixture.root)).status).toBe('current');
    });
  }
);

test('rebuild replaces search-derived data while preserving sources and external observations', async () => {
  await inWorkspace(async (fixture) => {
    const source = '# Notes\n\nOrchid care.\n';
    await fixture.write('notes.md', source);
    await fixture.write('.agent-wiki/external/observation.json', 'observation');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    await writeFile(indexPaths(fixture.root).dbPath, 'corrupt database');
    const result = await indexWiki(fixture.root, {
      rebuild: true,
      embed: deferEmbeddings,
    });
    expect(result.update).toMatchObject({ indexed: 1 });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'notes.md'
    );
    expect(await readFile(join(fixture.root, 'notes.md'), 'utf8')).toBe(source);
    expect(
      await readFile(
        join(fixture.root, '.agent-wiki/external/observation.json'),
        'utf8'
      )
    ).toBe('observation');
  });
});

test('rebuild with incomplete sources refuses destructive derived-state removal', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md', '# Notes\n\nOrchid snapshot.\n');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const result = await indexWiki(fixture.root, {
      rebuild: true,
      embed: deferEmbeddings,
      io: failSource('/notes.md'),
    });
    expect(result).toMatchObject({ complete: false, update: null });
    expect((await indexedHits(fixture.root, 'orchid'))[0]?.path).toBe(
      'notes.md'
    );
    await rm(indexPaths(fixture.root).dbPath);
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'absent',
      indexComplete: false,
    });
  });
});
