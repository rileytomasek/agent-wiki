import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { moveFilesystem } from '../src/moves/io.ts';
import type { MoveIO } from '../src/moves/io.ts';
import { moveDocument } from '../src/operations/move.ts';
import {
  blockedLink,
  retainedBackup,
  isReferenceBackup,
} from './fixtures/move-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

function failureIO(kind: 'write' | 'rename' | 'link'): MoveIO {
  let calls = 0;
  return {
    ...moveFilesystem,
    async [kind](...args: [string, string, number?]) {
      calls++;
      if (calls === 2) throw new Error(`Injected ${kind} failure`);
      if (kind === 'write')
        await moveFilesystem.write(args[0], args[1], args[2] ?? 0o644);
      else await moveFilesystem[kind](args[0], args[1]);
    },
  };
}

test.each(['write', 'rename', 'link'] as const)(
  'a partial %s failure restores every original',
  async (kind) => {
    await inWorkspace(async ({ root, write }) => {
      await write('a.md', '# A\n');
      await write('ref.md', '# R\n\n[A](a.md)\n');
      const result = await moveDocument(root, 'a.md', 'deep/new.md', {
        io: failureIO(kind),
      });
      expect(result).toMatchObject({
        status: 'rolled-back',
        complete: false,
        recoveryPaths: [],
      });
      expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# A\n');
      expect(await readFile(join(root, 'ref.md'), 'utf8')).toBe(
        '# R\n\n[A](a.md)\n'
      );
      await expect(lstat(join(root, 'deep'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(result.diagnostics.at(-1)?.message).toContain(
        `Injected ${kind} failure`
      );
    });
  }
);

test('a rollback failure retains recovery files and accurately reports partial state', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    const io = blockedLink(join(root, 'ref.md'));
    const result = await moveDocument(root, 'a.md', 'new.md', { io });
    expect(result.status).toBe('partial');
    expect(result.files).toEqual([
      { path: 'a.md', state: 'original' },
      { path: 'new.md', state: 'missing' },
      { path: 'ref.md', state: 'missing' },
    ]);
    expect(result.complete).toBe(false);
    expect(result.recoveryPaths.some((path) => isReferenceBackup(path))).toBe(
      true
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'move.rollback'
    );
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# A\n');
    await expect(lstat(join(root, 'ref.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await readdir(root)).some((path) => path.endsWith('.backup'))).toBe(
      true
    );
  });
});

test('cleanup failures report applied content with retained originals and nonzero completeness', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    const io = retainedBackup();
    const result = await moveDocument(root, 'a.md', 'new.md', { io });
    expect(result).toMatchObject({ status: 'applied', complete: false });
    expect(result.recoveryPaths).toHaveLength(1);
    expect(result.diagnostics.at(-1)?.code).toBe('move.cleanup');
    expect(await readFile(join(root, 'new.md'), 'utf8')).toBe('# A\n');
  });
});

test('a preview with a newly unreadable source reports incomplete outcome states', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md');
    const io: MoveIO = {
      ...moveFilesystem,
      read: () => Promise.reject(new Error('Unreadable now')),
    };
    const result = await moveDocument(root, 'a.md', 'new.md', {
      io,
      dryRun: true,
    });
    expect(result).toMatchObject({ status: 'dry-run', complete: false });
    expect(result.files).toEqual([
      { path: 'a.md', state: 'unreadable' },
      { path: 'new.md', state: 'missing' },
    ]);
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# Title\n');
  });
});
