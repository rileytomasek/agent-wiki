import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  indexStatus,
  indexWiki,
  readDocument,
  validate,
} from '../src/index.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { failDirectory, failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

const selections = ['records/**/*.md'];

test('index selections retain repository-relative identities and the full reference boundary', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('docs/guide.md', '# Guide\n\nOrchid documentation.\n');
    await fixture.write('assets/chart.svg', '<svg/>');
    const source =
      '---\nabout: [../docs/guide.md]\n---\n# Record\n\nOrchid record. [Chart](../assets/chart.svg)\n';
    await fixture.write('records/one.md', source);
    const result = await indexWiki(fixture.root, {
      selections,
      embed: deferEmbeddings,
    });
    expect(result.update).toMatchObject({ indexed: 1 });
    expect(result.state).toMatchObject({
      selections,
      coverage: { discovered: 1, readable: 1, projected: 1, complete: true },
      baseline: { selections, sources: [{ path: 'records/one.md' }] },
    });
    const hits = await indexedHits(fixture.root, 'orchid');
    expect(hits.map((hit) => hit.path)).toEqual(['records/one.md']);
    expect(hits[0]?.metadata['about']).toEqual(['docs/guide.md']);
    expect((await validate(fixture.root, ['records'])).valid).toBe(true);
    expect((await readDocument(fixture.root, 'records/one.md')).source).toBe(
      source
    );
    expect(
      (await readDocument(fixture.root, 'docs/guide.md')).source
    ).toContain('documentation');
  });
});

test('unselected edits, additions, deletions and read failures do not change index currency', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    await fixture.write('docs/guide.md');
    await fixture.write('removed.md');
    await indexWiki(fixture.root, { selections, embed: deferEmbeddings });
    await fixture.write('docs/guide.md', '# Changed\n');
    await fixture.write('added.md');
    await rm(join(fixture.root, 'removed.md'));
    const result = await indexStatus(fixture.root, {
      io: failSource('/docs/guide.md'),
    });
    expect(result).toMatchObject({
      selections,
      currency: 'current',
      complete: true,
      changes: { added: [], changed: [], removed: [] },
    });
    expect(
      await indexStatus(fixture.root, { io: failDirectory('/docs') })
    ).toMatchObject({
      currency: 'current',
      complete: true,
    });
    const repeated = await indexWiki(fixture.root, {
      embed: deferEmbeddings,
      io: failDirectory('/docs'),
    });
    expect(repeated.state.coverage.complete).toBe(true);
    expect(
      repeated.diagnostics.some((problem) => problem.path.startsWith('docs'))
    ).toBe(false);
  });
});

test('saved selections refresh changed records and remove the final matching record', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid original.\n');
    await fixture.write('outside.md', '# Outside\n\nOrchid excluded.\n');
    await indexWiki(fixture.root, { selections, embed: deferEmbeddings });
    await fixture.write('records/one.md', '# Record\n\nAmber replacement.\n');
    expect((await indexStatus(fixture.root)).changes.changed).toEqual([
      'records/one.md',
    ]);
    expect(
      (await readDocument(fixture.root, 'records/one.md')).source
    ).toContain('Amber');
    expect(await indexedHits(fixture.root, 'amber')).toEqual([]);
    expect(
      (await indexWiki(fixture.root, { embed: deferEmbeddings })).update
        ?.updated
    ).toBe(1);
    const rebuilt = await indexWiki(fixture.root, {
      rebuild: true,
      embed: deferEmbeddings,
    });
    expect(rebuilt.state.selections).toEqual(selections);
    expect(rebuilt.update?.indexed).toBe(1);
    expect(await indexedHits(fixture.root, 'orchid')).toEqual([]);
    await rm(join(fixture.root, 'records/one.md'));
    expect((await indexStatus(fixture.root)).changes.removed).toEqual([
      'records/one.md',
    ]);
    const empty = await indexWiki(fixture.root);
    expect(empty).toMatchObject({ complete: true, update: { removed: 1 } });
    expect(empty.state.selections).toEqual(selections);
    expect(await indexedHits(fixture.root, 'orchid')).toEqual([]);
    await fixture.write('records/new.md', '# New\n\nViolet addition.\n');
    expect((await indexStatus(fixture.root)).changes.added).toEqual([
      'records/new.md',
    ]);
    expect(
      (await indexWiki(fixture.root, { embed: deferEmbeddings })).update
        ?.indexed
    ).toBe(1);
  });
});

test('selection changes reconcile the whole mirror and an explicit empty set restores all documents', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    await fixture.write('docs/guide.md', '# Guide\n\nOrchid guide.\n');
    await fixture.write('notes.md', '# Notes\n\nOrchid notes.\n');
    await indexWiki(fixture.root, {
      selections: ['records'],
      embed: deferEmbeddings,
    });
    const changed = await indexWiki(fixture.root, {
      selections: ['./docs/', 'notes.md', 'docs'],
      embed: deferEmbeddings,
    });
    expect(changed.state.selections).toEqual(['docs', 'notes.md']);
    expect(changed.update).toMatchObject({ indexed: 2, removed: 1 });
    expect(
      (await indexedHits(fixture.root, 'orchid'))
        .map((hit) => hit.path)
        .toSorted()
    ).toEqual(['docs/guide.md', 'notes.md']);
    expect((await indexStatus(fixture.root)).currency).toBe('current');
    const all = await indexWiki(fixture.root, {
      selections: [],
      embed: deferEmbeddings,
    });
    expect(all.update).toMatchObject({ indexed: 1, unchanged: 2 });
    expect(all.state.baseline?.sources).toHaveLength(3);
  });
});
