import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { run } from './process.ts';
import { copyRepository } from './repository-fixture.ts';

function initialize(directory: string) {
  const options = { cwd: directory };
  run('git', ['init', '--initial-branch=proof'], options);
  run('git', ['config', 'user.name', 'Hook proof'], options);
  run('git', ['config', 'user.email', 'hook-proof@example.invalid'], options);
  run('git', ['add', '.'], options);
  // Seed only the disposable fixture; the real hook is enabled for the next commit.
  run('git', ['commit', '-m', 'Seed fixture'], {
    ...options,
    env: { ...process.env, HUSKY: '0' },
  });
  run(process.execPath, ['scripts/install-hooks.ts'], {
    ...options,
    env: { ...process.env, CI: 'false', HUSKY: '1' },
  });
}

async function commitProof(directory: string) {
  const options = { cwd: directory, env: { ...process.env, HUSKY: '1' } };
  const path = join(directory, 'src/version.ts');
  await writeFile(path, 'export const version="0.0.1"\n');
  run('git', ['add', 'src/version.ts'], options);
  const readme = join(directory, 'README.md');
  const original = await readFile(readme, 'utf8');
  await writeFile(readme, `${original}\nUnstaged hook proof.\n`);
  run('git', ['commit', '-m', 'Verify staged formatting'], options);
  assert.equal(
    await readFile(path, 'utf8'),
    "export const version = '0.0.1';\n"
  );
  assert.match(
    run('git', ['diff', '--', 'README.md'], options),
    /Unstaged hook proof/u
  );
  await writeFile(readme, original);
}

async function pushProof(directory: string) {
  const remote = join(directory, '.cache/hook-remote.git');
  run('git', ['init', '--bare', remote]);
  run('git', ['remote', 'add', 'proof', remote], { cwd: directory });
  await writeFile(
    join(directory, 'src/version.ts'),
    "export const version: any = '0.0.0';\n"
  );
  const result = spawnSync('git', ['push', 'proof', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, HUSKY: '1' },
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /bun run fmt:check/u);
  assert.match(result.stdout + result.stderr, /no-explicit-any/u);
  assert.equal(run('git', ['--git-dir', remote, 'for-each-ref']).trim(), '');
}

const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-hooks-'));
try {
  await copyRepository(directory);
  initialize(directory);
  await commitProof(directory);
  await pushProof(directory);
  console.log(
    'Actual Git hooks: staged fixes, unstaged preservation, rejected push passed'
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
