import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'vitest';

import { projectDocument } from '../src/search/projection.ts';
import { openSearchStore } from '../src/search/qmd.ts';
import {
  metadataSnapshot,
  projectedContent,
  projectionSnapshot,
} from './fixtures/projection.ts';
import { createFixture } from './fixtures/wiki.ts';

test('the pinned public QMD store accepts projected literal paths and native filters', async () => {
  const fixture = await createFixture();
  const path = 'notes/literal %20#日本語.md';
  const source =
    '---\ntype: doc/guide\nabout: [../projects/literal%20#name.md]\nstale_after: 2000-01-01\nemail: invalid\n---\n# Orchid\n\nOrchid evidence[^n].\n\n[^n]: Qualified source.\n';
  const projection = projectDocument(projectionSnapshot(source, path));
  const target = join(fixture.paths.mirrorPath, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, projectedContent(projection));
  const store = await openSearchStore(fixture.paths);
  try {
    expect(await store.update()).toMatchObject({ indexed: 1 });
    expect(await store.status()).toMatchObject({
      totalDocuments: 1,
      pendingMetadata: 0,
    });
    const hits = await store.searchLex('orchid', {
      filter: {
        operator: 'and',
        operands: [
          { key: 'type', operator: 'eq', value: 'doc/guide' },
          {
            key: 'about',
            operator: 'eq',
            value: 'projects/literal%20#name.md',
          },
          { key: 'stale_after', operator: 'lte', value: '2026-09-16' },
        ],
      },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe(path);
    expect(hits[0]?.metadata).toEqual(projection.metadata);
  } finally {
    await store.close();
    await fixture.dispose();
  }
});

test('native metadata extraction accepts boundary strings and arrays after omission', async () => {
  const fixture = await createFixture();
  const projection = projectDocument(
    metadataSnapshot({
      address: '😀'.repeat(512),
      aliases: Array.from({ length: 128 }, (_, index) => `alias-${index}`),
      phone: 'x'.repeat(1025),
    })
  );
  await writeFile(
    join(fixture.paths.mirrorPath, 'limits.md'),
    projectedContent(projection)
  );
  const store = await openSearchStore(fixture.paths);
  try {
    await store.update();
    const hits = await store.searchLex('orchid', {
      filter: { key: 'aliases', operator: 'eq', value: 'alias-127' },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.metadata['address']).toBe('😀'.repeat(512));
    expect(hits[0]?.metadata).not.toHaveProperty('phone');
    expect(await store.status()).toMatchObject({
      totalDocuments: 1,
      pendingMetadata: 0,
    });
  } finally {
    await store.close();
    await fixture.dispose();
  }
});
