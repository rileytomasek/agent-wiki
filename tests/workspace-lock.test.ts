import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexWiki } from '../src/search/index.ts';
import { acquireWorkspaceLock } from '../src/workspace/write-lock.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('exclusive locks block other writers and can be explicitly released', async () => {
  await inWorkspace(async (fixture) => {
    const lock = await acquireWorkspaceLock(fixture.root);
    try {
      await expect(acquireWorkspaceLock(fixture.root)).rejects.toThrow(
        'Workspace is locked'
      );
      await expect(indexWiki(fixture.root)).rejects.toThrow(
        'Existing locks are never stolen'
      );
      expect(await readFile(lock.path, 'utf8')).toContain('"pid":');
    } finally {
      await lock.release();
    }
    expect((await indexWiki(fixture.root)).complete).toBe(true);
  });
});

test('abandoned locks remain visible until inspected and removed explicitly', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      '.agent-wiki/cache/write.lock',
      '{"pid":99999999,"host":"old","token":"abandoned"}\n'
    );
    await expect(indexWiki(fixture.root)).rejects.toThrow(
      'remove this abandoned lock and retry'
    );
    await rm(join(fixture.root, '.agent-wiki/cache/write.lock'));
    expect((await indexWiki(fixture.root)).complete).toBe(true);
  });
});

test('release refuses to remove a lock whose ownership changed', async () => {
  await inWorkspace(async (fixture) => {
    const lock = await acquireWorkspaceLock(fixture.root);
    await writeFile(lock.path, 'replacement owner');
    await expect(lock.release()).rejects.toThrow('ownership changed');
    expect(await readFile(lock.path, 'utf8')).toBe('replacement owner');
  });
});

test('derived directory symlinks cannot write or rebuild outside the wiki', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('wiki/.agent-wiki');
    await fixture.write('outside/sentinel.md', 'sentinel');
    const root = join(fixture.root, 'wiki');
    await symlink('../../outside', join(root, '.agent-wiki/cache'));
    await expect(indexWiki(root, { rebuild: true })).rejects.toThrow(
      'Refusing a symlink'
    );
    expect(
      await readFile(join(fixture.root, 'outside/sentinel.md'), 'utf8')
    ).toBe('sentinel');
  });
});

test('a mirror directory symlink refuses ordinary indexing and rebuild', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('wiki/.agent-wiki/cache');
    await fixture.write('outside/sentinel.md', 'sentinel');
    const root = join(fixture.root, 'wiki');
    await symlink(
      '../../../outside',
      join(root, '.agent-wiki/cache/search-documents')
    );
    expect((await indexWiki(root)).complete).toBe(false);
    expect((await indexWiki(root, { rebuild: true })).complete).toBe(false);
    expect(
      await readFile(join(fixture.root, 'outside/sentinel.md'), 'utf8')
    ).toBe('sentinel');
  });
});

test('rogue mirror file symlinks never reach QMD indexing', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('wiki/.agent-wiki/cache/search-documents');
    await fixture.write('wiki/notes.md');
    await fixture.write('outside.md', '# Secret\n');
    const root = join(fixture.root, 'wiki');
    await symlink(
      '../../../../outside.md',
      join(root, '.agent-wiki/cache/search-documents/notes.md')
    );
    const result = await indexWiki(root);
    expect(result).toMatchObject({ complete: false, update: null });
    expect(result.diagnostics[0]?.message).toContain('symlink');
    expect(await readFile(join(fixture.root, 'outside.md'), 'utf8')).toBe(
      '# Secret\n'
    );
  });
});
