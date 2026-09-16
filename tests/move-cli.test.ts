import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { runCli } from '../src/cli/run.ts';
import {
  readCommand,
  readJson,
  readObject,
  readObjects,
} from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('the executable prints a complete dry-run diff and JSON exposes every edit', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md', '# A\n');
    await write('ref.md', '# R\n\n[A](a.md)\n');
    const preview = readCommand(root, [
      '--root',
      root,
      'move',
      'a.md',
      'deep/new.md',
      '--dry-run',
    ]);
    expect(preview.status).toBe(0);
    expect(preview.stderr).toBe('');
    expect(preview.stdout).toContain(
      'rename from "a.md"\nrename to "deep/new.md"'
    );
    expect(preview.stdout).toContain('-[A](a.md)\n');
    expect(preview.stdout).toContain('+[A](deep/new.md)\n');
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toContain('(a.md)');
    const applied = readCommand(root, [
      '--json',
      'move',
      'a.md',
      'deep/new.md',
      '--root',
      root,
    ]);
    expect(applied.status).toBe(0);
    expect(applied.stderr).toBe('');
    const result = readJson(applied.stdout);
    expect(result['status']).toBe('applied');
    const plan = readObject(result['plan']);
    expect(readObjects(plan['changes'])).toHaveLength(2);
    expect(await readFile(join(root, 'ref.md'), 'utf8')).toContain(
      '(deep/new.md)'
    );
  });
});

test('direct CLI and subprocess errors preserve JSON and meaningful exit status', async () => {
  await inWorkspace(async ({ root, write }) => {
    await write('a.md');
    await write('existing.md');
    const collision = await runCli(['move', 'a.md', 'existing.md', '--json'], {
      cwd: root,
    });
    expect(collision.exitCode).toBe(1);
    expect(
      readObjects(readJson(collision.stdout)['diagnostics'])[0]?.['code']
    ).toBe('move-collision');
    const filtered = readCommand(root, [
      'move',
      'a.md',
      'new.md',
      '--type',
      'doc',
    ]);
    expect(filtered.status).toBe(1);
    expect(filtered.stderr).toContain('--type is not supported');
    const wrongCommand = await runCli(['show', 'a.md', '--dry-run'], {
      cwd: root,
    });
    expect(wrongCommand.exitCode).toBe(1);
    expect(wrongCommand.stderr).toContain('--dry-run is not supported');
    const help = readCommand(root, ['move', '--help']);
    expect(help.stdout).toContain('--dry-run');
  });
});
