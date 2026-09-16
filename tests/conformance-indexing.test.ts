import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  indexStatus,
  indexWiki,
  searchWiki,
  showDocument,
} from '../src/index.ts';
import { exampleSources, inExampleWiki } from './fixtures/example-wiki.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { readCommand, readJson } from './fixtures/read-cli.ts';
import { lexicalSearch } from './fixtures/search.ts';

test('example source edits appear in reads immediately and enter the index only after explicit refresh', async () => {
  await inExampleWiki(async (fixture) => {
    const before = await exampleSources(fixture.root);
    expect((await indexStatus(fixture.root)).availability).toBe('absent');
    const indexed = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(indexed.update).toMatchObject({ indexed: 7 });
    expect(indexed.complete).toBe(false);
    expect(indexed.state.qmd?.needsEmbedding).toBe(7);
    expect(await exampleSources(fixture.root)).toEqual(before);
    const status = readCommand(fixture.root, ['status', '--json']);
    expect(status.status).toBe(0);
    expect(status.stderr).toBe('');
    expect(readJson(status.stdout)).toMatchObject({
      currency: 'current',
      status: 'incomplete',
      pendingEmbeddings: 7,
    });
    const path = 'guides/deployment.md';
    const original = await readFile(join(fixture.root, path), 'utf8');
    await fixture.write(path, `${original}\nVioletdeployment sentinel.\n`);
    expect((await showDocument(fixture.root, path)).content).toContain(
      'Violetdeployment'
    );
    const stale = await searchWiki(fixture.root, 'violetdeployment', {
      search: lexicalSearch,
    });
    expect(stale.documents).toEqual([]);
    expect(stale.indexNotice?.message).toContain('source currency is stale');
    expect(await indexStatus(fixture.root)).toMatchObject({
      currency: 'stale',
      changes: { changed: [path] },
    });
    const repeated = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(repeated.update).toMatchObject({ updated: 1, unchanged: 6 });
    const current = await searchWiki(fixture.root, 'violetdeployment', {
      search: lexicalSearch,
    });
    expect(current.documents.map((document) => document.path)).toEqual([path]);
    expect((await indexStatus(fixture.root)).currency).toBe('current');
    expect(
      (await showDocument(fixture.root, path)).document.metadata.stale_after
    ).toBe('2026-12-01');
  });
});
