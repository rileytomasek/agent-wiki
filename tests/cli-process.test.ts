import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { expect, test, vi } from 'vitest';

import { version } from '../src/index.ts';

test('the executable runs under Node outside the working directory', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      resolve('tests/fixtures/deny-qmd.ts'),
      resolve('src/cli/bin.ts'),
      '-v',
    ],
    {
      cwd: '/tmp',
      encoding: 'utf8',
    }
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(`${version}\n`);
  expect(result.stderr).toBe('');
});

test('library import and help do not load QMD', () => {
  const loader = resolve('tests/fixtures/deny-qmd.ts');
  const result = spawnSync(
    process.execPath,
    ['--import', loader, '--eval', "await import('./src/index.ts')"],
    { encoding: 'utf8' }
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  const help = spawnSync(
    process.execPath,
    ['--import', loader, 'src/cli/bin.ts', '--help'],
    { encoding: 'utf8' }
  );
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('Usage: wiki');
});

test('the executable writes the result streams and exit code', async () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  const previous = process.exitCode;
  vi.stubGlobal('process', process);
  const argv = process.argv;
  process.argv = ['node', 'wiki', 'unknown'];
  try {
    await import('../src/cli/bin.ts');
    expect(stdout).toHaveBeenCalledWith('');
    expect(stderr).toHaveBeenCalledWith('wiki: Unknown command: unknown\n');
    expect(process.exitCode).toBe(1);
  } finally {
    process.argv = argv;
    process.exitCode = previous;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
