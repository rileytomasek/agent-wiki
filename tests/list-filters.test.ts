import { expect, test } from 'vitest';

import { listDocuments } from '../src/operations/list.ts';
import { writeListDocument, writeTypeCorpus } from './fixtures/list-corpus.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('exact type and available segments respect plain and deeper open-vocabulary types', async () => {
  await inWorkspace(async (fixture) => {
    await writeTypeCorpus(fixture);
    const plain = await listDocuments(fixture.root, {
      filters: { type: 'person' },
    });
    expect(plain.documents.map((document) => document.path)).toEqual([
      'a/plain.md',
    ]);
    const named = await listDocuments(fixture.root, {
      filters: { category: 'entity', name: 'person' },
    });
    expect(named.documents.map((document) => document.path)).toEqual([
      'b/deep.md',
      'c/base.md',
    ]);
    const exact = await listDocuments(fixture.root, {
      filters: { type: 'entity/person', name: 'person' },
    });
    expect(exact.documents.map((document) => document.path)).toEqual([
      'c/base.md',
    ]);
    expect(
      (await listDocuments(fixture.root, { filters: { category: 'person' } }))
        .documents
    ).toEqual([]);
    expect(
      (await listDocuments(fixture.root, { filters: { category: 'Entity' } }))
        .documents
    ).toEqual([]);
  });
});

test('about identities resolve from the document while filter paths are root relative and literal', async () => {
  await inWorkspace(async (fixture) => {
    await writeListDocument(fixture, 'notes/encoded.md', {
      about: ['../subjects/a%20b.md'],
    });
    await writeListDocument(fixture, 'notes/spaced.md', {
      about: ['../subjects/a b.md'],
    });
    const encoded = await listDocuments(fixture.root, {
      filters: { about: './subjects/a%20b.md' },
    });
    expect(encoded.documents.map((document) => document.path)).toEqual([
      'notes/encoded.md',
    ]);
    const spaced = await listDocuments(fixture.root, {
      filters: { about: 'subjects/a b.md' },
    });
    expect(spaced.documents.map((document) => document.path)).toEqual([
      'notes/spaced.md',
    ]);
    const absent = await listDocuments(fixture.root, {
      filters: { about: 'subjects/absent.md' },
    });
    expect(absent).toMatchObject({
      documents: [],
      total: 0,
      complete: true,
      truncated: false,
    });
  });
});

test('AND filters and list globs apply before the document limit', async () => {
  await inWorkspace(async (fixture) => {
    await writeTypeCorpus(fixture);
    const filtered = await listDocuments(fixture.root, {
      filters: {
        category: 'entity',
        name: 'person',
        about: 'subjects/main.md',
        path: '**/*.md',
      },
      limit: 1,
    });
    expect(filtered.documents.map((document) => document.path)).toEqual([
      'b/deep.md',
    ]);
    expect(filtered).toMatchObject({
      total: 2,
      truncated: true,
      complete: true,
    });
    const directory = await listDocuments(fixture.root, {
      filters: { path: './c/*.md' },
      limit: 1,
    });
    expect(directory.documents.map((document) => document.path)).toEqual([
      'c/base.md',
    ]);
    expect(directory.truncated).toBe(false);
    expect((await listDocuments(fixture.root)).documents).toHaveLength(5);
  });
});

test('invalid limits, empty filters and escaping paths fail before filesystem access', async () => {
  await expect(listDocuments('/missing/wiki', { limit: 0 })).rejects.toThrow(
    'positive safe integer'
  );
  await expect(listDocuments('/missing/wiki', { limit: 1.5 })).rejects.toThrow(
    'positive safe integer'
  );
  await expect(
    listDocuments('/missing/wiki', { limit: Number.POSITIVE_INFINITY })
  ).rejects.toThrow('positive safe integer');
  await expect(
    listDocuments('/missing/wiki', { filters: { type: ' ' } })
  ).rejects.toThrow('must not be empty');
  await expect(
    listDocuments('/missing/wiki', { filters: { about: '../outside.md' } })
  ).rejects.toThrow('root-relative Markdown path');
  await expect(
    listDocuments('/missing/wiki', { filters: { path: '/absolute/*.md' } })
  ).rejects.toThrow('root-relative path glob');
});

test('an omitted limit returns every matching document', async () => {
  await inWorkspace(async (fixture) => {
    const paths = Array.from(
      { length: 24 },
      (_, index) => `document-${index}.md`
    );
    await Promise.all(paths.map((path) => fixture.write(path)));
    const listed = await listDocuments(fixture.root);
    expect(listed.documents.map((document) => document.path)).toEqual(
      paths.toSorted()
    );
    expect(listed).toMatchObject({
      total: 24,
      truncated: false,
      complete: true,
    });
  });
});
