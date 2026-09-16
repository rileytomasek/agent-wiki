import { readFile } from 'node:fs/promises';

import { assert, property, string } from 'fast-check';
import { expect, test } from 'vitest';

import { parseArguments } from '../src/cli/arguments.ts';
import { runCli } from '../src/cli/run.ts';
import { version } from '../src/index.ts';

test('help and version agree with the package and support JSON', async () => {
  const manifest: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  expect(manifest).toHaveProperty('version', version);
  expect(runCli([])).toMatchObject({ exitCode: 0, stderr: '' });
  expect(runCli(['--help']).stdout).toContain('Usage: wiki [command]');
  expect(runCli(['--version']).stdout).toBe(`${version}\n`);
  expect(JSON.parse(runCli(['--json', '-v']).stdout)).toEqual({
    version,
    diagnostics: [],
  });
  expect(
    JSON.parse(runCli(['--json', 'show', '--help']).stdout)
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

test('argument boundaries preserve literals and diagnose invalid options', () => {
  expect(parseArguments(['show', '--', '--json']).operands).toEqual(['--json']);
  expect(parseArguments(['show', '--', '--json']).json).toBe(false);
  expect(runCli(['--root']).exitCode).toBe(1);
  expect(runCli(['--unknown']).stderr).toContain('Unknown option');
  expect(runCli(['--json=false']).exitCode).toBe(1);
  const malformed = runCli(['--json', '--unknown']);
  expect(malformed.exitCode).toBe(1);
  expect(malformed.stderr).toBe('');
  expect(JSON.parse(malformed.stdout)).toHaveProperty('diagnostics');
});

test('unavailable and unknown commands fail honestly with separated output', () => {
  const result = runCli(['show', 'doc.md']);
  expect(result).toMatchObject({ stdout: '', exitCode: 1 });
  expect(result.stderr).toContain('not implemented yet');
  expect(runCli(['typo']).stderr).toContain('Unknown command: typo');
  const structured = runCli(['--json', 'typo']);
  expect(structured.stderr).toBe('');
  expect(structured.exitCode).toBe(1);
  expect(JSON.parse(structured.stdout)).toEqual({
    diagnostics: [{ code: 'cli_error', message: 'Unknown command: typo' }],
  });
});
