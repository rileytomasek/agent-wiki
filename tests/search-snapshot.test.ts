import { readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { showDocument } from '../src/operations/show.ts';
import { indexPaths } from '../src/search/index-paths.ts';
import { indexWiki } from '../src/search/index.ts';
import { searchWiki } from '../src/search/search.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import {
  firstDocument,
  lexicalSearch,
  prepareSearch,
  searchClock,
} from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('edits, deletions and moves leave indexed paths, titles, snippets and review dates usable', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const before = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
      clock: searchClock,
    });
    const recorded = await readFile(indexPaths(fixture.root).statePath, 'utf8');
    await fixture.write(
      'guides/literal %20# café.md',
      '---\nstale_after: 2999-01-01\n---\n# Changed title\n\nCobalt current body.\n'
    );
    await rm(join(fixture.root, 'guides/old.md'));
    await rename(
      join(fixture.root, 'guides/future.md'),
      join(fixture.root, 'guides/moved.md')
    );
    const after = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
      clock: searchClock,
    });
    expect(after.documents).toEqual(before.documents);
    expect(after.indexNotice?.message).toContain('source currency is stale');
    expect(after.indexNotice?.recoveryCommand).toBe('wiki index');
    expect(after.complete).toBe(true);
    expect(await readFile(indexPaths(fixture.root).statePath, 'utf8')).toBe(
      recorded
    );
    const current = await showDocument(
      fixture.root,
      'guides/literal %20# café.md',
      { clock: searchClock }
    );
    expect(current.document.title).toBe('Changed title');
    expect(current.document.review.stale).toBe(false);
    expect(current.content).toContain('Cobalt current body.');
  });
});

test('missing or incompatible bookkeeping yields one unknown-state notice while the database remains searchable', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    await fixture.write('.agent-wiki/cache/index-state.json', '{invalid');
    const result = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
    });
    expect(result.documents).toHaveLength(7);
    expect(result.indexNotice).toMatchObject({
      status: 'unknown',
      recoveryCommand: 'wiki index',
    });
    expect(result.indexNotice?.diagnostics).toHaveLength(1);
    expect(result.complete).toBe(false);
    await rm(indexPaths(fixture.root).statePath);
    const missing = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
    });
    expect(missing.documents).toHaveLength(7);
    expect(missing.indexNotice?.status).toBe('unknown');
    expect(missing.complete).toBe(true);
  });
});

test('tolerantly indexed content uses native metadata-only snippets and omits custom enrichment', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'notes.md',
      '---\ntype: doc/guide\naliases: [sentinelmetadata]\nemail: invalid\nunknown: value\n---\n# Usable notes\n\nOrdinary text.\n'
    );
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const result = await searchWiki(fixture.root, 'sentinelmetadata', {
      search: lexicalSearch,
      filters: { type: 'doc/guide' },
    });
    const document = firstDocument(result.documents);
    expect(document.metadata['email']).toBeUndefined();
    expect(document.metadata['unknown']).toBeUndefined();
    expect(document.snippet.source).toBe('index');
    expect(document.snippet.text).toContain('sentinelmetadata');
    expect(document).not.toHaveProperty('headingContext');
    expect(document).not.toHaveProperty('footnotes');
    expect(document).not.toHaveProperty('line');
    expect(document).not.toHaveProperty('body');
  });
});
