import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { readCache } from '../src/workspace/cache.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { refreshWorkspace } from '../src/workspace/snapshots.ts';
import { failDirectory, failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('failed subdirectory scans preserve older cache records but confirm independent removals', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('good.md');
    await fixture.write('gone.md');
    await fixture.write('nested/retained.md');
    await refreshWorkspace(fixture.root);
    await rm(join(fixture.root, 'gone.md'));
    const partial = await refreshWorkspace(fixture.root, {
      io: failDirectory('/nested'),
    });
    expect(partial.complete).toBe(false);
    expect(partial.removed).toEqual(['gone.md']);
    expect(partial.documents.map((snapshot) => snapshot.document.path)).toEqual(
      ['good.md']
    );
    expect(partial.problems).toMatchObject([
      { path: 'nested', code: 'workspace.scan' },
    ]);
    expect(
      (await readCache(fixture.root)).map((record) => record.path)
    ).toEqual(['good.md', 'nested/retained.md']);
    await rm(join(fixture.root, 'nested'), { recursive: true });
    expect((await refreshWorkspace(fixture.root)).removed).toEqual([
      'nested/retained.md',
    ]);
  });
});

test('an unreadable document is discovered but never returned as a current cached snapshot', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('good.md');
    await fixture.write('retained.md');
    await refreshWorkspace(fixture.root);
    await fixture.write('retained.md', '# Changed\n');
    const partial = await refreshWorkspace(fixture.root, {
      io: failSource('/retained.md'),
    });
    expect(partial.complete).toBe(false);
    expect(partial.removed).toEqual([]);
    expect(partial.documentPaths).toEqual(['good.md', 'retained.md']);
    expect(partial.documents.map((snapshot) => snapshot.document.path)).toEqual(
      ['good.md']
    );
    expect(partial.problems).toMatchObject([
      { path: 'retained.md', code: 'workspace.read' },
    ]);
    expect(
      (await readCache(fixture.root)).map((record) => record.title)
    ).toEqual(['Title', 'Title']);
    expect(
      (await refreshWorkspace(fixture.root)).documents.map(
        (snapshot) => snapshot.document.title
      )
    ).toEqual(['Title', 'Changed']);
  });
});

test('a failed root scan cannot establish any deletion', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('retained.md');
    await refreshWorkspace(fixture.root);
    const partial = await refreshWorkspace(fixture.root, {
      io: {
        ...filesystemIO,
        readDirectory: () => Promise.reject(new Error('Root scan failed')),
      },
    });
    expect(partial.complete).toBe(false);
    expect(partial.documents).toEqual([]);
    expect(partial.removed).toEqual([]);
    expect(await readCache(fixture.root)).toHaveLength(1);
  });
});
