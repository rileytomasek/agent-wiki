import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { copyRepository } from './repository-fixture.ts';

function fails(directory: string, program: string, args: readonly string[]) {
  const result = spawnSync(process.execPath, [resolve(program), ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  assert.notEqual(
    result.status,
    0,
    `Expected ${program} to reject the fixture`
  );
  return result.stdout + result.stderr;
}

async function lintProof(directory: string) {
  const paths = ['src', 'tests', 'scripts', 'tooling'].map(
    (area) => `${area}/limit-probe.ts`
  );
  const body = `export function excessive(value: any) {\n${'  String(value);\n'.repeat(61)}}\nPromise.resolve(1);\n`;
  await Promise.all(
    paths.map((path) => writeFile(join(directory, path), body))
  );
  const output = fails(directory, 'node_modules/oxlint/bin/oxlint', [
    '--deny-warnings',
    '--report-unused-disable-directives',
    ...paths,
  ]);
  for (const path of paths) assert.ok(output.includes(path));
  assert.match(output, /max-lines-per-function/u);
  assert.match(output, /no-explicit-any/u);
  assert.match(output, /no-floating-promises/u);
  await Promise.all(paths.map((path) => rm(join(directory, path))));
}

async function architectureProof(directory: string) {
  const cases = [
    {
      path: 'src/cli/qmd-probe.ts',
      module: '@tobilu/qmd',
      name: 'createStore',
    },
    {
      path: 'src/documents/io-probe.ts',
      module: 'node:fs/promises',
      name: 'readFile',
    },
    { path: 'src/cli-import-probe.ts', module: './cli/run.ts', name: 'runCli' },
    {
      path: 'src/search/private-probe.ts',
      module: '@tobilu/qmd/dist/index.js',
      name: 'createStore',
    },
  ];
  await Promise.all(
    cases.map(async ({ path, module, name }) => {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(
        join(directory, path),
        `import { ${name} } from '${module}';\nexport const probe = ${name};\n`
      );
    })
  );
  for (const { path } of cases) {
    const output = fails(directory, 'node_modules/oxlint/bin/oxlint', [path]);
    assert.match(output, /no-restricted-imports/u);
    assert.ok(output.includes(path), output);
  }
  await Promise.all(cases.map(({ path }) => rm(join(directory, path))));
}

async function typeAndKnipProof(directory: string) {
  const typePath = join(directory, 'tests/type-probe.ts');
  await writeFile(
    typePath,
    'export function first(items: readonly string[]): string { return items[0]; }\n'
  );
  assert.match(
    fails(directory, 'node_modules/typescript/bin/tsc', ['--noEmit']),
    /TS2322/u
  );
  await rm(typePath);
  const deadPath = join(directory, 'src/unused-probe.ts');
  await writeFile(deadPath, 'export const unused = true;\n');
  assert.match(
    fails(directory, 'node_modules/knip/bin/knip.js', []),
    /unused-probe.ts/u
  );
  assert.match(
    fails(directory, 'node_modules/knip/bin/knip.js', ['--production']),
    /unused-probe.ts/u
  );
  await rm(deadPath);
}

async function runnerProof(directory: string) {
  const file = join(directory, 'tests/runner-probe.test.ts');
  const prefix = "import { expect, test } from 'vitest';\n";
  await writeFile(
    file,
    `${prefix}test.only('focus', () => { expect(true).toBe(true); });\n`
  );
  assert.match(
    fails(directory, 'node_modules/vitest/vitest.mjs', ['run', 'runner-probe']),
    /only|focused/iu
  );
  await writeFile(
    file,
    `${prefix}test('async', () => { void Promise.reject(new Error('unhandled-proof')); });\n`
  );
  assert.match(
    fails(directory, 'node_modules/vitest/vitest.mjs', ['run', 'runner-probe']),
    /unhandled-proof/u
  );
  assert.match(
    fails(directory, 'node_modules/vitest/vitest.mjs', [
      'run',
      'missing-proof-test',
    ]),
    /No test files/u
  );
  await writeFile(
    file,
    `${prefix}test('coverage', () => { expect(true).toBe(true); });\n`
  );
  await writeFile(
    join(directory, 'src/unimported-probe.ts'),
    'export function unimported(): number { return 42; }\n'
  );
  assert.match(
    fails(directory, 'node_modules/vitest/vitest.mjs', [
      'run',
      'runner-probe',
      '--coverage',
    ]),
    /coverage.*threshold/iu
  );
  const lcov = await readFile(join(directory, 'coverage/lcov.info'), 'utf8');
  assert.match(lcov, /SF:src\/unimported-probe.ts/u);
  assert.match(lcov, /SF:src\/cli\/bin.ts/u);
}

const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-tooling-'));
try {
  await copyRepository(directory);
  await lintProof(directory);
  await architectureProof(directory);
  await typeAndKnipProof(directory);
  await runnerProof(directory);
  console.log(
    'Enforcement proof: lint limits/types, both Knip modes, focused/empty/async tests, unimported/CLI coverage passed'
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
