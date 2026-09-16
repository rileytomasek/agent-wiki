import { expect, test } from 'vitest';

import {
  documentPaths,
  readCommand,
  readJson,
  readObject,
  readObjects,
  writeReadCorpus,
} from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each([
  ['before', ['--json', '--root'], ['list']],
  ['after', ['list', '--json', '--root'], []],
])('global flags work %s the command', async (_position, before, after) => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a.md');
    const result = readCommand(fixture.root, [
      ...before,
      fixture.root,
      ...after,
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const data = readJson(result.stdout);
    expect(documentPaths(data)).toEqual(['a.md']);
    expect(data).toMatchObject({
      total: 1,
      truncated: false,
      complete: true,
      diagnostics: [],
    });
  });
});

test('list ANDs exact type/category/name/about/path filters before limiting', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      'list',
      '--type',
      'doc/guide',
      '--category',
      'doc',
      '--name',
      'guide',
      '--about',
      'subjects/orchid.md',
      '--path',
      'notes/*old.md',
      '--limit',
      '1',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(documentPaths(data)).toEqual(['notes/a-old.md']);
    expect(data).toMatchObject({ total: 2, truncated: true, complete: true });
    expect(result.stderr).toBe('');
  });
});

test('path globs are expanded by list and about resolves from the content root', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      '--root',
      '.',
      'list',
      '--about',
      'subjects/orchid.md',
      '--path',
      'notes/b*.md',
      '--limit',
      '1',
      '--json',
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(documentPaths(data)).toEqual(['notes/b-old.md']);
    expect(data).toMatchObject({ total: 1, truncated: false });
  });
});

test('stale list sorts oldest deadlines then paths and excludes future or undated documents', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      'list',
      '--stale',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(documentPaths(data)).toEqual([
      'notes/b-old.md',
      'notes/e-other.md',
      'notes/a-old.md',
      'notes/d-note.md',
    ]);
    const reviews = readObjects(data['documents']).map((document) =>
      readObject(document['review'])
    );
    expect(reviews).toMatchObject([
      { stale: true, deadline: '2000-01-01' },
      { stale: true, deadline: '2000-01-01' },
      { stale: true, deadline: '2001-01-01' },
      { stale: true, deadline: '2005-01-01' },
    ]);
    expect(reviews[0]?.['daysOverdue']).toBeGreaterThan(0);
    expect(data).toMatchObject({ total: 4, truncated: false });
  });
});

test('ordinary list keeps stale, future and undated documents visible', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      'list',
      '--type',
      'doc/guide',
      '--about',
      'subjects/orchid.md',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(documentPaths(data)).toEqual([
      'notes/a-old.md',
      'notes/b-old.md',
      'notes/c-new.md',
      'notes/f-undated.md',
    ]);
    expect(data).toMatchObject({ total: 4, truncated: false });
  });
});

test.each([
  ['--type', 'doc'],
  ['--type', 'doc/guide', '--category', 'entity'],
])('an exact filter with no matches succeeds: %s', async (...filters) => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      'list',
      ...filters,
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    expect(readJson(result.stdout)).toMatchObject({
      documents: [],
      total: 0,
      truncated: false,
      diagnostics: [],
      complete: true,
    });
    expect(result.stderr).toBe('');
  });
});
