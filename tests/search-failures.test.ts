import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { searchWiki } from '../src/search/search.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { lexicalSearch, prepareSearch } from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('a failed currency inspection keeps snapshot hits and reports incomplete inspection once', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const read = vi
      .spyOn(filesystemIO, 'readSource')
      .mockImplementation(readWithFailure);
    try {
      const result = await searchWiki(fixture.root, 'orchid', {
        search: lexicalSearch,
      });
      expect(result.documents).toHaveLength(7);
      expect(result.complete).toBe(false);
      expect(result.indexNotice?.status).toBe('unknown');
      expect(
        result.indexNotice?.diagnostics.map((diagnostic) => diagnostic.code)
      ).toContain('index.source');
    } finally {
      read.mockRestore();
    }
  });
});

test('a missing index is actionable and search does not initialize derived state', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('source.md');
    await expect(
      searchWiki(fixture.root, 'orchid', { search: lexicalSearch })
    ).rejects.toMatchObject({
      code: 'search.index-missing',
    });
    await expect(stat(join(fixture.root, '.agent-wiki'))).rejects.toMatchObject(
      { code: 'ENOENT' }
    );
  });
});

test('native query failures remain failures rather than successful empty results', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const search = vi.fn<() => Promise<never>>(() =>
      Promise.reject(new Error('Native query failure'))
    );
    await expect(
      searchWiki(fixture.root, 'orchid', { search })
    ).rejects.toMatchObject({
      code: 'search.failed',
    });
    expect(search).toHaveBeenCalledTimes(1);
  });
});

function readWithFailure(path: string): Promise<string> {
  if (path.endsWith('old.md'))
    return Promise.reject(new Error('Source temporarily unreadable'));
  return readFile(path, 'utf8');
}
