import { strict as assert } from 'node:assert';
import { copyFile, lstat, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import manifest from '../package.json' with { type: 'json' };
import { run } from './process.ts';

const fixtures = [
  'runtime.ts',
  'types.ts',
  'cli.ts',
  'workflows.ts',
  'models.ts',
];

export async function prepareConsumer(directory: string, artifact: string) {
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'wiki-consumer-proof',
      private: true,
      type: 'module',
      dependencies: { [manifest.name]: artifact },
      devDependencies: { typescript: '7.0.2', '@types/node': '22.20.2' },
      trustedDependencies: ['better-sqlite3', 'node-llama-cpp'],
    })
  );
  await Promise.all(
    fixtures.map((file) =>
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

export async function verifyConsumer(
  directory: string,
  manager: 'npm' | 'bun'
) {
  const env = {
    ...process.env,
    // npm consumers must install and run with Node/npm alone.
    PATH:
      manager === 'npm'
        ? `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`
        : process.env['PATH'],
    XDG_CACHE_HOME: resolve('.cache/model-smoke'),
  };
  const options = { cwd: directory, env };
  const args =
    manager === 'npm'
      ? ['install', '--no-audit', '--no-fund']
      : [
          'install',
          '--linker',
          'isolated',
          '--cache-dir',
          join(directory, 'bun-cache'),
        ];
  run(manager, args, options);
  const installed = await realpath(
    join(directory, 'node_modules', manifest.name)
  );
  assert.ok(
    installed.startsWith(`${await realpath(directory)}${sep}node_modules${sep}`)
  );
  assert.equal(
    run(
      process.execPath,
      ['node_modules/typescript/bin/tsc', '--noEmit'],
      options
    ),
    ''
  );
  const runtime = manager === 'bun' ? 'bun' : process.execPath;
  const scripts = ['runtime.ts', 'cli.ts', 'workflows.ts'];
  if (process.argv.includes('--models')) scripts.push('models.ts');
  for (const file of scripts) console.log(run(runtime, [file], options).trim());
  const cli = join(directory, 'node_modules/.bin/wiki');
  assert.match(run(cli, ['--help'], options), /Usage: wiki/u);
  assert.equal(run(cli, ['--version'], options), `${manifest.version}\n`);
  await assert.rejects(lstat(join(directory, 'node_modules/husky')), {
    code: 'ENOENT',
  });
  console.log(
    `${manager} consumer passed on ${process.platform}/${process.arch}`
  );
}
