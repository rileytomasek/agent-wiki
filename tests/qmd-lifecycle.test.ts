import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { openSearchStore } from '../src/index.ts';
import { createFixture } from './fixtures/wiki.ts';

test('interleaved stores, whole updates, removals and reopening remain isolated', async () => {
  const left = await createFixture();
  const right = await createFixture();
  const configPath = join(left.directory, 'index.yml');
  const sentinel = 'collections: {}\n# existing configuration\n';
  await writeFile(configPath, sentinel);
  vi.stubEnv('QMD_CONFIG_DIR', left.directory);
  await left.write('left.md');
  await left.write('unchanged.md');
  await right.write('right.md');
  const first = await openSearchStore(left.paths);
  const second = await openSearchStore(right.paths);
  try {
    await first.update();
    await second.update();
    await left.write('left.md', {}, 'Cobalt replacement');
    expect(await first.update()).toMatchObject({
      updated: 1,
      unchanged: 1,
      removed: 0,
    });
    expect((await first.searchLex('orchid')).map((hit) => hit.path)).toEqual([
      'unchanged.md',
    ]);
    expect((await second.searchLex('orchid')).map((hit) => hit.path)).toEqual([
      'right.md',
    ]);
    await left.remove('left.md');
    expect(await first.update()).toMatchObject({ removed: 1, unchanged: 1 });
  } finally {
    await first.close();
  }
  try {
    await right.write('later.md');
    expect(await second.update()).toMatchObject({ indexed: 1, unchanged: 1 });
    expect(await second.status()).toHaveProperty('totalDocuments', 2);
    const reopened = await openSearchStore(left.paths);
    try {
      expect(await reopened.status()).toHaveProperty('totalDocuments', 1);
    } finally {
      await reopened.close();
    }
    expect(await readFile(configPath, 'utf8')).toBe(sentinel);
  } finally {
    await second.close();
    vi.unstubAllEnvs();
    await left.dispose();
    await right.dispose();
  }
});

test('an empty store has no embedding work and closes cleanly', async () => {
  const fixture = await createFixture();
  const store = await openSearchStore(fixture.paths);
  try {
    expect(await store.update()).toMatchObject({
      indexed: 0,
      needsEmbedding: 0,
    });
    expect(await store.embed()).toMatchObject({ docsProcessed: 0, errors: 0 });
    expect(await store.searchLex('missing')).toEqual([]);
  } finally {
    await store.close();
    await fixture.dispose();
  }
});
