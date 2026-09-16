import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { PARSER_VERSION } from '../src/documents/parse.ts';
import { readCache } from '../src/workspace/cache.ts';
import { DISCOVERY_VERSION } from '../src/workspace/discovery.ts';
import { readDocument, refreshWorkspace } from '../src/workspace/snapshots.ts';
import { cachePath, inWorkspace } from './fixtures/workspace.ts';

test('unmarked reads stay in memory and cache contains normalized parses only', async () => {
  await inWorkspace(async (fixture) => {
    const source = '# Source\n\nUnique body text never duplicated in JSON.\n';
    await fixture.write('source.md', source);
    await refreshWorkspace(fixture.root);
    await expect(stat(join(fixture.root, '.agent-wiki'))).rejects.toThrow(
      'ENOENT'
    );
    await fixture.directory('.agent-wiki');
    await refreshWorkspace(fixture.root);
    const serialized = await readFile(cachePath(fixture.root), 'utf8');
    expect(serialized).toContain(PARSER_VERSION);
    expect(serialized).not.toContain('Unique body text');
    expect(serialized).not.toContain('children');
    expect(await readCache(fixture.root)).toHaveLength(1);
  });
});

test('source hashes detect same-size edits even when the mtime is preserved', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('source.md', '# First\n');
    const first = await readDocument(fixture.root, 'source.md');
    const path = join(fixture.root, 'source.md');
    const before = await stat(path);
    await writeFile(path, '# Other\n');
    await utimes(path, before.atime, before.mtime);
    const second = await readDocument(fixture.root, 'source.md');
    expect(second.document.title).toBe('Other');
    expect(second.document.sourceHash).not.toBe(first.document.sourceHash);
    expect(await readDocument(fixture.root, 'source.md')).toEqual(second);
  });
});

test('corrupt JSON and incompatible parser/cache versions are reconstructed', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki/cache');
    await fixture.write('source.md');
    const path = cachePath(fixture.root);
    await writeFile(path, '{broken');
    expect((await readDocument(fixture.root, 'source.md')).document.title).toBe(
      'Title'
    );
    const record = (await readDocument(fixture.root, 'source.md')).document;
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        parserVersion: 'old',
        discoveryVersion: DISCOVERY_VERSION,
        records: [record],
      })
    );
    expect(await readCache(fixture.root)).toEqual([]);
    await refreshWorkspace(fixture.root);
    expect(await readCache(fixture.root)).toHaveLength(1);
    await writeFile(
      path,
      JSON.stringify({
        version: 0,
        parserVersion: PARSER_VERSION,
        discoveryVersion: DISCOVERY_VERSION,
        records: [record],
      })
    );
    expect(await readCache(fixture.root)).toEqual([]);
  });
});

test('optional cache writes failing do not prevent usable document reads', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      '.agent-wiki/cache',
      'a file blocks the cache directory'
    );
    await fixture.write('source.md');
    expect((await readDocument(fixture.root, 'source.md')).source).toBe(
      '# Title\n'
    );
    const workspace = await refreshWorkspace(fixture.root);
    expect(workspace.complete).toBe(true);
    expect(workspace.documents).toHaveLength(1);
  });
});

test('changed discovery policy invalidates the cache envelope', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('source.md');
    const record = (await readDocument(fixture.root, 'source.md')).document;
    await writeFile(
      cachePath(fixture.root),
      JSON.stringify({
        version: 1,
        parserVersion: PARSER_VERSION,
        discoveryVersion: 'old',
        records: [record],
      })
    );
    expect(await readCache(fixture.root)).toEqual([]);
    expect((await refreshWorkspace(fixture.root)).documents).toHaveLength(1);
  });
});
