import { readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { PARSER_VERSION } from '../src/documents/parse.ts';
import { readCache } from '../src/workspace/cache.ts';
import { DISCOVERY_VERSION } from '../src/workspace/discovery.ts';
import { readDocument, refreshWorkspace } from '../src/workspace/snapshots.ts';
import { cachePath, inWorkspace } from './fixtures/workspace.ts';

test('unchanged cache hits still read and hash source but reuse the normalized parse', async () => {
  const parser = await import('../src/documents/parse.ts');
  const parse = vi.spyOn(parser, 'parseDocument');
  try {
    await inWorkspace(async (fixture) => {
      await fixture.directory('.agent-wiki');
      await fixture.write('source.md');
      await readDocument(fixture.root, 'source.md');
      await readDocument(fixture.root, 'source.md');
      await refreshWorkspace(fixture.root);
      expect(parse).toHaveBeenCalledTimes(1);
      await fixture.write('source.md', '# Updated\n');
      await readDocument(fixture.root, 'source.md');
      expect(parse).toHaveBeenCalledTimes(2);
    });
  } finally {
    parse.mockRestore();
  }
});

test('invalid cached nested data and out-of-source spans are rejected', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('source.md');
    const record = (await readDocument(fixture.root, 'source.md')).document;
    const envelope = {
      version: 1,
      parserVersion: PARSER_VERSION,
      discoveryVersion: DISCOVERY_VERSION,
    };
    await writeFile(
      cachePath(fixture.root),
      JSON.stringify({
        ...envelope,
        records: [{ ...record, metadata: { aliases: [27] } }],
      })
    );
    expect(await readCache(fixture.root)).toEqual([]);
    await writeFile(
      cachePath(fixture.root),
      JSON.stringify({
        ...envelope,
        records: [{ ...record, body: { ...record.body, end: 999999 } }],
      })
    );
    expect((await readDocument(fixture.root, 'source.md')).document).toEqual(
      record
    );
    await writeFile(
      cachePath(fixture.root),
      JSON.stringify({
        ...envelope,
        records: [{ ...record, references: [{ destination: 'x' }] }],
      })
    );
    expect(await readCache(fixture.root)).toEqual([]);
  });
});

test('cache directory symlinks cannot write beyond the wiki root', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('wiki/.agent-wiki');
    await fixture.directory('outside');
    await fixture.write('outside/documents.json', 'sentinel');
    await fixture.write('wiki/source.md');
    const root = join(fixture.root, 'wiki');
    await symlink('../../outside', join(root, '.agent-wiki/cache'));
    expect((await refreshWorkspace(root)).complete).toBe(true);
    expect(
      await readFile(join(fixture.root, 'outside/documents.json'), 'utf8')
    ).toBe('sentinel');
    expect(await readCache(root)).toEqual([]);
  });
});
