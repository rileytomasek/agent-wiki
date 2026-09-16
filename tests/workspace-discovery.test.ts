import { rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { discoverWorkspace } from '../src/workspace/discovery.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { readDocument, refreshWorkspace } from '../src/workspace/snapshots.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('visible Markdown and attachments use one deterministic discovery policy', async () => {
  await inWorkspace(async (fixture) => {
    const ignored = [
      '.agent-wiki',
      '.git',
      'node_modules',
      '.cache',
      'vendor',
      'dist',
      'build',
      '.private',
    ];
    await Promise.all(
      ignored.map((directory) => fixture.write(`${directory}/ignored.md`))
    );
    await fixture.write('z.md');
    await fixture.write('nested/a.md');
    await fixture.write('nested/photo.png', 'image');
    await fixture.write('.hidden.md');
    const inventory = await discoverWorkspace(fixture.root);
    expect(inventory.files).toEqual([
      'nested/a.md',
      'nested/photo.png',
      'z.md',
    ]);
    expect(inventory.documentPaths).toEqual(['nested/a.md', 'z.md']);
    expect(inventory.complete).toBe(true);
    expect((await refreshWorkspace(fixture.root)).documents).toHaveLength(2);
  });
});

test('directory symlinks and outside files are excluded while in-root file links are readable', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('wiki/real/document.md');
    await fixture.write('outside.md', '# Outside\n');
    const root = join(fixture.root, 'wiki');
    await symlink('real', join(root, 'directory'));
    await symlink('real/document.md', join(root, 'inside.md'));
    await symlink('../outside.md', join(root, 'outside.md'));
    await symlink('missing.md', join(root, 'broken.md'));
    expect((await discoverWorkspace(root)).files).toEqual([
      'inside.md',
      'real/document.md',
    ]);
    expect((await readDocument(root, 'inside.md')).document.title).toBe(
      'Title'
    );
    await expect(readDocument(root, 'outside.md')).rejects.toThrow('escapes');
    await expect(readDocument(root, 'directory/document.md')).rejects.toThrow(
      'ancestor'
    );
    await expect(readDocument(root, '../outside.md')).rejects.toThrow(
      'escapes'
    );
  });
});

test('a directory replaced by a symlink during discovery cannot expose external content', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('outside/secret.md');
    await fixture.directory('wiki/changed');
    const root = join(fixture.root, 'wiki');
    const inventory = await discoverWorkspace(root, {
      ...filesystemIO,
      async readDirectory(path) {
        const entries = await filesystemIO.readDirectory(path);
        await rm(join(root, 'changed'), { recursive: true });
        await symlink('../outside', join(root, 'changed'));
        return entries;
      },
    });
    expect(inventory.files).toEqual([]);
    expect(inventory.complete).toBe(false);
    expect(inventory.problems).toMatchObject([
      { code: 'workspace.scan', path: 'changed' },
    ]);
  });
});
