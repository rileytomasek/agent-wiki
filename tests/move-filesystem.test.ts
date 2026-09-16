import {
  chmod,
  lstat,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { applyMove, moveDocument } from '../src/operations/move.ts';
import { related } from '../src/operations/related.ts';
import { showDocument } from '../src/operations/show.ts';
import { validate } from '../src/operations/validate.ts';
import { readCache } from '../src/workspace/cache.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('dry-run writes no authored files and its reviewed plan applies successfully', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n\n[Asset](asset.png)\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    await write('asset.png', 'attachment bytes');
    await chmod(join(root, 'a.md'), 0o640);
    const preview = await moveDocument(root, 'a.md', 'deep/new.md', {
      dryRun: true,
    });
    expect(preview.status).toBe('dry-run');
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toContain('(a.md)');
    await expect(lstat(join(root, 'deep'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const result = await applyMove(preview.plan);
    expect(result).toMatchObject({
      status: 'applied',
      complete: true,
      recoveryPaths: [],
    });
    expect(await readFile(join(root, 'deep/new.md'), 'utf8')).toBe(
      '# A\n\n[Asset](../asset.png)\n'
    );
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toContain(
      '(deep/new.md)'
    );
    expect((await lstat(join(root, 'deep/new.md'))).mode & 0o777).toBe(0o640);
    await expect(lstat(join(root, 'a.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readCache(root)).toEqual([]);
    expect((await validate(root)).valid).toBe(true);
    expect(
      (await readdir(root)).filter((path) => path.includes('wiki-move-'))
    ).toEqual([]);
  });
});

test('changed referrers, newly discovered files and occupied destinations invalidate a plan', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('other.md', '# Other\n');
    const { plan } = await moveDocument(root, 'a.md', 'new.md', {
      dryRun: true,
    });
    await write('other.md', '# Changed\n\n[A](a.md)\n');
    await expect(applyMove(plan)).rejects.toThrow(
      'changed since this move was planned'
    );
    await write('other.md', '# Other\n');
    await write('added.md', '# Added\n');
    await expect(applyMove(plan)).rejects.toThrow(
      'changed since this move was planned'
    );
    await write('new.md', '# Occupied\n');
    await expect(applyMove(plan)).rejects.toThrow(
      'changed since this move was planned'
    );
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# A\n');
    expect(await readFile(join(root, 'new.md'), 'utf8')).toBe('# Occupied\n');
  });
});

test('modified or omitted planned edits cannot become an arbitrary write', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    const { plan } = await moveDocument(root, 'a.md', 'new.md', {
      dryRun: true,
    });
    await expect(
      applyMove({
        ...plan,
        changes: plan.changes.filter((change) => change.path === 'a.md'),
      })
    ).rejects.toThrow('complete reference-preserving move');
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toContain('(a.md)');
  });
});

test('symlinked authored sources and destination parents are refused', async () => {
  await inWorkspace(async ({ root, write, directory }) => {
    await write('a.md');
    await symlink(join(root, 'a.md'), join(root, 'link.md'));
    await expect(moveDocument(root, 'link.md', 'new.md')).rejects.toThrow(
      'symlink or non-file source'
    );
    await directory('actual');
    await symlink(join(root, 'actual'), join(root, 'alias'));
    await expect(
      moveDocument(root, 'a.md', 'alias/new.md', { dryRun: true })
    ).rejects.toThrow('symlink or non-directory parent');
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# Title\n');
  });
});

test('a new occupied destination discovered immediately before apply is never overwritten', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md');
    const { plan } = await moveDocument(root, 'a.md', 'new.md', {
      dryRun: true,
    });
    await writeFile(join(root, 'new.md'), 'external writer', { flag: 'wx' });
    await expect(applyMove(plan)).rejects.toThrow(
      'changed since this move was planned'
    );
    expect(await readFile(join(root, 'new.md'), 'utf8')).toBe(
      'external writer'
    );
  });
});

test('moving a target of discovered file symlinks is refused without breaking incoming links', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('ref.md', '# R\n\n[Alias](alias.md) [Attachment](alias.txt)\n');
    await symlink(join(root, 'a.md'), join(root, 'alias.md'));
    await symlink(join(root, 'a.md'), join(root, 'alias.txt'));
    expect((await validate(root)).valid).toBe(true);
    await expect(moveDocument(root, 'a.md', 'new.md')).rejects.toMatchObject({
      code: 'move-symlink-target',
      candidates: ['alias.md', 'alias.txt'],
    });
    expect((await validate(root)).valid).toBe(true);
    expect(await readFile(join(root, 'alias.md'), 'utf8')).toBe('# A\n');
    await expect(lstat(join(root, 'new.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

test('unrelated usable file symlinks do not prevent an otherwise safe move', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('other.md', '# Other\n');
    await symlink(join(root, 'other.md'), join(root, 'alias.md'));
    expect((await moveDocument(root, 'a.md', 'new.md')).complete).toBe(true);
    expect(await readFile(join(root, 'alias.md'), 'utf8')).toBe('# Other\n');
  });
});

test('a symlink to a rewritten referrer cannot acquire different relative-link meanings', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    await write('sub/a.md', '# Separate A\n');
    await symlink(join(root, 'ref.md'), join(root, 'sub/alias.md'));
    expect((await validate(root)).valid).toBe(true);
    await expect(moveDocument(root, 'a.md', 'new.md')).rejects.toMatchObject({
      code: 'move-symlink-target',
      candidates: ['sub/alias.md'],
    });
    expect((await validate(root)).valid).toBe(true);
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toBe(
      '# R\n\n[A](a.md)\n'
    );
  });
});

test('real path and heading targets take priority over a conflicting full alias', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n\n## Part\n');
    await write('b.md', '---\naliases: ["a.md#part"]\n---\n# B\n');
    const shown = await showDocument(root, 'a.md#part');
    expect(shown.document.path).toBe('a.md');
    expect(shown.section?.anchor).toBe('part');
    expect((await related(root, 'a.md#part')).target).toMatchObject({
      kind: 'section',
      path: 'a.md',
      anchor: 'part',
    });
    await expect(
      moveDocument(root, 'a.md#part', 'new.md', { dryRun: true })
    ).rejects.toThrow('whole Markdown document');
    expect(await readFile(join(root, 'b.md'), 'utf8')).toContain('# B\n');
  });
});
