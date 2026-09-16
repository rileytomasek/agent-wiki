import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { moveDocument } from '../src/operations/move.ts';
import { validate } from '../src/operations/validate.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.runIf(process.platform === 'darwin')(
  'macOS behavior tests prove the fixture filesystem is case-insensitive',
  async () => {
    await inWorkspace(async ({ root, write }) => {
      await write('case-probe.md', '# Probe\n');
      const lower = await lstat(join(root, 'case-probe.md'));
      const upper = await lstat(join(root, 'CASE-PROBE.md'));
      expect(upper.ino).toBe(lower.ino);
      expect(upper.dev).toBe(lower.dev);
      expect(await readdir(root)).toEqual(['case-probe.md']);
    });
  }
);

test('case-only renames retain exactly the requested directory entry and fix references', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n\n[Self](a.md)\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    const result = await moveDocument(root, 'a.md', 'A.md');
    expect(result).toMatchObject({
      status: 'applied',
      complete: true,
      recoveryPaths: [],
    });
    expect(await readdir(root)).toEqual(['.agent-wiki', 'A.md', 'ref.md']);
    expect(await readFile(join(root, 'A.md'), 'utf8')).toBe(
      '# A\n\n[Self](A.md)\n'
    );
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toBe(
      '# R\n\n[A](A.md)\n'
    );
    expect((await validate(root)).valid).toBe(true);
  });
});
