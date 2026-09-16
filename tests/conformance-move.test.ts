import { expect, test } from 'vitest';

import {
  indexWiki,
  moveDocument,
  searchWiki,
  showDocument,
  validate,
} from '../src/index.ts';
import { exampleSources, inExampleWiki } from './fixtures/example-wiki.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { readCommand, readJson } from './fixtures/read-cli.ts';
import { lexicalSearch } from './fixtures/search.ts';

test('the example wiki stays connected across preview, CLI move, stale search, reindex and public-library move', async () => {
  await inExampleWiki(async (fixture) => {
    const from = 'projects/website.md';
    const to = 'archive/project.md';
    const before = await exampleSources(fixture.root);
    const original = await showDocument(fixture.root, from);
    const options = {
      search: lexicalSearch,
      filters: { type: 'entity/project' },
    };
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const preview = readCommand(fixture.root, [
      'move',
      from,
      to,
      '--dry-run',
      '--json',
    ]);
    expect(preview.status).toBe(0);
    expect(readJson(preview.stdout)['status']).toBe('dry-run');
    expect(await exampleSources(fixture.root)).toEqual(before);
    const moved = readCommand(fixture.root, ['--json', 'move', from, to]);
    expect(moved.status).toBe(0);
    expect(moved.stderr).toBe('');
    expect(readJson(moved.stdout)).toMatchObject({
      status: 'applied',
      complete: true,
    });
    expect((await validate(fixture.root)).valid).toBe(true);
    const current = await showDocument(fixture.root, 'Website project');
    expect(current.document.path).toBe(to);
    expect(current.document.review).toEqual(original.document.review);
    const stale = await searchWiki(fixture.root, 'website', options);
    expect(stale.documents.map((document) => document.path)).toEqual([from]);
    expect(stale.indexNotice?.message).toContain('source currency is stale');
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const refreshed = await searchWiki(fixture.root, 'website', options);
    expect(refreshed.documents.map((document) => document.path)).toEqual([to]);
    expect((await moveDocument(fixture.root, to, from)).status).toBe('applied');
    expect((await validate(fixture.root)).valid).toBe(true);
    expect((await showDocument(fixture.root, from)).document.review).toEqual(
      original.document.review
    );
  });
});
