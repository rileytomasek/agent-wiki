import { readFile } from 'node:fs/promises';

import { assert, property, string } from 'fast-check';
import { expect, test } from 'vitest';

import { parseArguments } from '../src/cli/arguments.ts';
import { runCli } from '../src/cli/run.ts';
import { version } from '../src/index.ts';

test('help and version agree with the package and support JSON', async () => {
  const manifest: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  expect(manifest).toHaveProperty('version', version);
  expect(await runCli([])).toMatchObject({ exitCode: 0, stderr: '' });
  expect((await runCli(['--help'])).stdout).toContain('Usage: wiki [command]');
  expect((await runCli(['--version'])).stdout).toBe(`${version}\n`);
  expect(JSON.parse((await runCli(['--json', '-v'])).stdout)).toEqual({
    version,
    diagnostics: [],
  });
  expect(
    JSON.parse((await runCli(['--json', 'show', '--help'])).stdout)
  ).toHaveProperty('help');
});

test('globals preserve their values on either side of a command', () => {
  assert(
    property(string(), (root) => {
      const before = parseArguments([
        `--root=${root}`,
        '--json',
        'show',
        'doc.md',
      ]);
      const after = parseArguments([
        'show',
        'doc.md',
        `--root=${root}`,
        '--json',
      ]);
      expect(before).toEqual(after);
      expect(after).toMatchObject({ root, json: true, operands: ['doc.md'] });
    })
  );
});

test('argument boundaries preserve literals and diagnose invalid options', async () => {
  expect(parseArguments(['show', '--', '--json']).operands).toEqual(['--json']);
  expect(parseArguments(['show', '--', '--json']).json).toBe(false);
  expect((await runCli(['--root'])).exitCode).toBe(1);
  expect((await runCli(['--unknown'])).stderr).toContain('Unknown option');
  expect((await runCli(['--json=false'])).exitCode).toBe(1);
  const malformed = await runCli(['--json', '--unknown']);
  expect(malformed.exitCode).toBe(1);
  expect(malformed.stderr).toBe('');
  expect(JSON.parse(malformed.stdout)).toHaveProperty('diagnostics');
});

test('unavailable and unknown commands fail honestly with separated output', async () => {
  const result = await runCli(['move', 'source.md', 'destination.md']);
  expect(result).toMatchObject({ stdout: '', exitCode: 1 });
  expect(result.stderr).toContain('not implemented yet');
  expect((await runCli(['typo'])).stderr).toContain('Unknown command: typo');
  const structured = await runCli(['--json', 'typo']);
  expect(structured.stderr).toBe('');
  expect(structured.exitCode).toBe(1);
  expect(JSON.parse(structured.stdout)).toEqual({
    diagnostics: [
      {
        code: 'cli_error',
        severity: 'error',
        message: 'Unknown command: typo',
        path: '',
      },
    ],
  });
});

test.each(['--root', '--limit', '--type'])(
  'JSON error mode survives a missing %s value before --json',
  async (option) => {
    const result = await runCli(['list', option, '--json']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toHaveProperty('diagnostics');
  }
);
