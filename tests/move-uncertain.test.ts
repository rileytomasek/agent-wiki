import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { moveFilesystem } from '../src/moves/io.ts';
import type { MoveIO } from '../src/moves/io.ts';
import { moveDocument } from '../src/operations/move.ts';
import { uncertainLink, occupiedDestination } from './fixtures/move-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('an uncertain successful replacement is detected and rolled back', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    const io = uncertainLink(join(root, 'new.md'));
    const result = await moveDocument(root, 'a.md', 'new.md', { io });
    expect(result).toMatchObject({ status: 'rolled-back', recoveryPaths: [] });
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# A\n');
    await expect(lstat(join(root, 'new.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

test('exclusive replacement creation preserves a concurrent destination writer', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    const io = occupiedDestination(join(root, 'new.md'));
    const result = await moveDocument(root, 'a.md', 'new.md', { io });
    expect(result.status).toBe('rolled-back');
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe('# A\n');
    expect(await readFile(join(root, 'new.md'), 'utf8')).toBe(
      'Concurrent writer'
    );
  });
});

test('a concurrent source edit while staging invalidates the plan without losing that edit', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    const io: MoveIO = {
      ...moveFilesystem,
      async write(path, source, mode) {
        await moveFilesystem.write(path, source, mode);
        await write('a.md', '# Concurrent edit\n');
      },
    };
    const result = await moveDocument(root, 'a.md', 'new.md', { io });
    expect(result.status).toBe('rolled-back');
    expect(result.diagnostics.at(-1)?.message).toContain('changed since');
    expect(await readFile(join(root, 'a.md'), 'utf8')).toBe(
      '# Concurrent edit\n'
    );
  });
});
