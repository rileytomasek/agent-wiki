import { expect, test } from 'vitest';

import { runCli } from '../src/cli/run.ts';
import {
  readCommand,
  readJson,
  readObject,
  readObjects,
} from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('validation reports structural errors with nonzero JSON and located text', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('bad.md', '# Bad\n\n[Missing](missing.md)\n');
    const json = readCommand(fixture.root, ['validate', '--json']);
    expect(json.status).toBe(1);
    expect(json.stderr).toBe('');
    expect(readJson(json.stdout)).toMatchObject({
      complete: true,
      valid: false,
    });
    const diagnostic = readObjects(readJson(json.stdout)['diagnostics'])[0];
    expect(diagnostic?.['path']).toBe('bad.md');
    expect(readObject(diagnostic?.['span'])['line']).toBe(3);
    const text = readCommand(fixture.root, ['validate']);
    expect(text.status).toBe(1);
    expect(text.stderr).toContain('bad.md:3:');
    expect(text.stdout).toContain('1');
  });
});

test('selected validation resolves unselected targets and limits document diagnostics', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes/a.md', '# A\n\n[B](../targets/b.md#details)\n');
    await fixture.write('targets/b.md', '# B\n\n## Details\n');
    await fixture.write('unrelated.md', 'No heading\n');
    const result = readCommand(fixture.root, [
      'validate',
      'notes/a.md',
      '--json',
    ]);
    expect(result.status).toBe(0);
    expect(readJson(result.stdout)).toMatchObject({
      selectedPaths: ['notes/a.md'],
      diagnostics: [],
      complete: true,
      valid: true,
    });
    expect(result.stderr).toBe('');
  });
});

test('quoted globs, recursive directories and multiple selections deduplicate', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes/a.md', '# A\n');
    await fixture.write('notes/deep/b.md', '# B\n');
    await fixture.write('other.md', '# Other\n');
    const result = readCommand(fixture.root, [
      '--json',
      'validate',
      'notes/**/*.md',
      'notes',
      'notes/a.md',
    ]);
    expect(result.status).toBe(0);
    expect(readJson(result.stdout)['selectedPaths']).toEqual([
      'notes/a.md',
      'notes/deep/b.md',
    ]);
  });
});

test.each([
  ['missing.md'],
  ['notes/*.md'],
  ['../outside.md'],
  ['--limit', '1'],
  ['--stale'],
])(
  'invalid validation selection or option is a structured error: %s',
  async (...args) => {
    await inWorkspace(async (fixture) => {
      await fixture.write('valid.md', '# Valid\n');
      const result = readCommand(fixture.root, ['validate', ...args, '--json']);
      expect(result.status).toBe(1);
      expect(
        readObjects(readJson(result.stdout)['diagnostics']).length
      ).toBeGreaterThan(0);
      expect(result.stderr).toBe('');
    });
  }
);

test('whole-wiki validation on an empty root succeeds without a search index', async () => {
  await inWorkspace(async (fixture) => {
    const result = await runCli(['validate', '--json'], { cwd: fixture.root });
    expect(result.exitCode).toBe(0);
    expect(readJson(result.stdout)).toMatchObject({
      selectedPaths: [],
      diagnostics: [],
      complete: true,
      valid: true,
    });
  });
});
