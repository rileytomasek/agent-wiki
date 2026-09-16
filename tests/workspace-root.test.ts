import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { resolveRoot } from '../src/workspace/root.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('explicit absolute and relative roots win without requiring a marker', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('one/two');
    const cwd = join(fixture.root, 'one');
    expect(await resolveRoot({ cwd, root: 'two' })).toBe(join(cwd, 'two'));
    expect(await resolveRoot({ cwd, root: fixture.root })).toBe(fixture.root);
    await expect(resolveRoot({ cwd, root: 'missing' })).rejects.toThrow(
      'ENOENT'
    );
  });
});

test('nearest marker wins inside Git and the Git root is checked inclusively', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.git');
    await fixture.directory('.agent-wiki');
    await fixture.directory('nested/.agent-wiki');
    await fixture.directory('nested/child');
    await fixture.directory('other/child');
    expect(await resolveRoot({ cwd: join(fixture.root, 'nested/child') })).toBe(
      join(fixture.root, 'nested')
    );
    expect(await resolveRoot({ cwd: join(fixture.root, 'other/child') })).toBe(
      fixture.root
    );
  });
});

test('Git boundaries stop marker lookup and a worktree .git file is supported', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('checkout/.git', 'gitdir: ../git/worktrees/checkout\n');
    await fixture.directory('checkout/child');
    const cwd = join(fixture.root, 'checkout/child');
    expect(await resolveRoot({ cwd })).toBe(cwd);
    await fixture.directory('checkout/.agent-wiki');
    expect(await resolveRoot({ cwd })).toBe(join(fixture.root, 'checkout'));
  });
});

test('outside Git only the original current directory is eligible', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.directory('child');
    const cwd = join(fixture.root, 'child');
    expect(await resolveRoot({ cwd })).toBe(cwd);
    await fixture.directory('child/.agent-wiki');
    expect(await resolveRoot({ cwd })).toBe(cwd);
  });
});

test('a marker symlink does not enable caches or ancestor root selection', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.git');
    await fixture.directory('derived');
    await fixture.directory('child');
    await symlink(
      join(fixture.root, 'derived'),
      join(fixture.root, '.agent-wiki')
    );
    const cwd = join(fixture.root, 'child');
    expect(await resolveRoot({ cwd })).toBe(cwd);
  });
});
