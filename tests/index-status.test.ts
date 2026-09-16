import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { indexPaths } from '../src/search/index-paths.ts';
import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import {
  deferEmbeddings,
  requireBaseline,
  rewriteState,
} from './fixtures/index.ts';
import { failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('status on an unmarked wiki creates no marker, cache, database or models', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md');
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'absent',
      availability: 'absent',
      currency: 'unknown',
      complete: true,
      indexComplete: false,
    });
    await expect(stat(join(fixture.root, '.agent-wiki'))).rejects.toThrow(
      'ENOENT'
    );
  });
});

test('status hashes current files without parsing and detects same-size preserved-mtime edits', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md', '# First\n');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const path = join(fixture.root, 'notes.md');
    const before = await stat(path);
    await fixture.write('notes.md', '# Other\n');
    await utimes(path, before.atime, before.mtime);
    const parser = await import('../src/documents/parse.ts');
    const parse = vi.spyOn(parser, 'parseDocument');
    try {
      const result = await indexStatus(fixture.root);
      expect(result.currency).toBe('stale');
      expect(result.changes.changed).toEqual(['notes.md']);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });
});

test('corrupt and incompatible state cannot establish current source coverage', async () => {
  await inWorkspace(async (fixture) => {
    await indexWiki(fixture.root);
    await rewriteState(fixture.root, (state) => ({
      ...state,
      baseline: {
        ...requireBaseline(state),
        versions: { ...requireBaseline(state).versions, projection: 'old' },
      },
    }));
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'unknown',
      currency: 'unknown',
    });
    await writeFile(indexPaths(fixture.root).statePath, '{broken');
    expect(await indexStatus(fixture.root)).toMatchObject({
      status: 'unknown',
      complete: false,
      pendingEmbeddings: null,
    });
  });
});

test('an obviously corrupt database is reported without recreating or opening QMD', async () => {
  await inWorkspace(async (fixture) => {
    await indexWiki(fixture.root);
    const database = indexPaths(fixture.root).dbPath;
    await writeFile(database, 'corrupt derived bytes');
    const before = await stat(database);
    const result = await indexStatus(fixture.root);
    expect(result).toMatchObject({
      status: 'unknown',
      availability: 'unknown',
      indexComplete: false,
      complete: false,
    });
    expect(result.diagnostics).toMatchObject([{ code: 'index.database' }]);
    expect(await readFile(database, 'utf8')).toBe('corrupt derived bytes');
    expect((await stat(database)).mtimeMs).toBe(before.mtimeMs);
  });
});

test('incomplete source inspection reports unknown currency instead of false removals', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const status = await indexStatus(fixture.root, {
      io: failSource('/notes.md'),
    });
    expect(status).toMatchObject({
      status: 'unknown',
      currency: 'unknown',
      complete: false,
      changes: { removed: [] },
    });
    expect(status.diagnostics[0]).toMatchObject({
      code: 'index.source',
      path: 'notes.md',
    });
  });
});
