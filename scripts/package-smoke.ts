import { strict as assert } from 'node:assert';
import {
  copyFile,
  lstat,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { run } from './process.ts';

async function pack(directory: string) {
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', directory]);
  const filename = (await readdir(directory)).find((name) =>
    name.endsWith('.tgz')
  );
  assert.ok(filename !== undefined);
  const artifact = join(directory, filename);
  const files = run('tar', ['-tzf', artifact]).trim().split('\n');
  assert.ok(files.includes('package/dist/index.d.ts'));
  assert.ok(files.includes('package/dist/cli/bin.js'));
  assert.ok(
    files.every((file) =>
      /^package\/(?:dist\/|README\.md$|package\.json$)/u.test(file)
    )
  );
  return artifact;
}

async function prepareConsumer(directory: string, artifact: string) {
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'wiki-consumer-proof',
      private: true,
      type: 'module',
      dependencies: { 'agent-wiki': `file:${artifact}` },
      devDependencies: { typescript: '7.0.2', '@types/node': '22.20.2' },
    })
  );
  await Promise.all(
    ['runtime.ts', 'types.ts', 'cli.ts', 'workflows.ts'].map((file) =>
      copyFile(resolve('tests/consumer', file), join(directory, file))
    )
  );
  await writeFile(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2023',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        types: ['node'],
      },
      include: ['*.ts'],
    })
  );
}

async function verify(directory: string) {
  // No Bun or Homebrew paths: installing a tarball must work with Node/npm alone.
  const env = {
    ...process.env,
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
  };
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: directory, env });
  const installed = join(directory, 'node_modules/agent-wiki');
  assert.equal((await lstat(installed)).isSymbolicLink(), false);
  assert.equal(
    run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], {
      cwd: directory,
      env,
    }),
    ''
  );
  for (const file of ['runtime.ts', 'cli.ts', 'workflows.ts']) {
    console.log(run(process.execPath, [file], { cwd: directory, env }).trim());
  }
  const cli = join(directory, 'node_modules/.bin/wiki');
  assert.match(run(cli, ['--help'], { cwd: directory, env }), /Usage: wiki/u);
  assert.match(
    run(cli, ['--version'], { cwd: directory, env }),
    /^0\.0\.0\n$/u
  );
  await assert.rejects(lstat(join(directory, 'node_modules/husky')), {
    code: 'ENOENT',
  });
}

const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-consumer-'));
try {
  const artifact = await pack(directory);
  await prepareConsumer(directory, artifact);
  await verify(directory);
  console.log(`Package consumer passed on ${process.platform}/${process.arch}`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
