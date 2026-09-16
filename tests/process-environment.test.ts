import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { run } from '../scripts/process.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('a dependency subprocess cannot reinitialize its invoking Git repository', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('caller');
    await fixture.directory('dependency');
    const caller = join(fixture.root, 'caller');
    const dependency = join(fixture.root, 'dependency');
    run('git', ['init', '--quiet'], { cwd: caller });
    const gitDirectory = join(caller, '.git');
    const config = join(gitDirectory, 'config');
    const before = await readFile(config, 'utf8');
    run('git', ['init', '--bare', '--quiet'], {
      cwd: dependency,
      env: {
        ...process.env,
        GIT_DIR: gitDirectory,
        GIT_COMMON_DIR: gitDirectory,
        GIT_INDEX_FILE: join(gitDirectory, 'index'),
      },
    });
    expect(await readFile(config, 'utf8')).toBe(before);
    expect((await stat(join(dependency, 'HEAD'))).isFile()).toBe(true);
    expect(
      run('git', ['rev-parse', '--is-bare-repository'], { cwd: caller })
    ).toBe('false\n');
    expect(
      run('git', ['rev-parse', '--is-bare-repository'], { cwd: dependency })
    ).toBe('true\n');
  });
});
