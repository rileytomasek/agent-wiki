import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

import { renderIndex } from '../src/cli/index-output.ts';
import { runCli } from '../src/cli/run.ts';
import { indexWiki } from '../src/search/index.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { readCommand, readJson } from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('native empty index emits one JSON result and status works with QMD imports denied', async () => {
  await inWorkspace(async (fixture) => {
    const before = readCommand(fixture.root, ['status', '--json']);
    expect(before.status).toBe(0);
    expect(readJson(before.stdout)).toMatchObject({
      status: 'absent',
      availability: 'absent',
    });
    await expect(stat(join(fixture.root, '.agent-wiki'))).rejects.toThrow(
      'ENOENT'
    );
    const indexed = spawnSync(
      process.execPath,
      [resolve('src/cli/bin.ts'), '--root', fixture.root, 'index', '--json'],
      { encoding: 'utf8', timeout: 20_000 }
    );
    expect(indexed.status).toBe(0);
    expect(readJson(indexed.stdout)).toMatchObject({
      complete: true,
      state: { coverage: { complete: true } },
    });
    const status = readCommand(fixture.root, ['--json', 'status']);
    expect(status.status).toBe(0);
    expect(readJson(status.stdout)).toMatchObject({
      status: 'current',
      indexComplete: true,
      pendingEmbeddings: 0,
    });
    expect(status.stderr).toBe('');
  });
});

test('incomplete indexing renders a valid result with a nonzero exit code', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('notes.md');
    const result = await indexWiki(fixture.root, { embed: deferEmbeddings });
    const json = renderIndex(result, true);
    expect(json).toMatchObject({ exitCode: 1, stderr: '' });
    expect(readJson(json.stdout)).toMatchObject({
      complete: false,
      state: { qmd: { needsEmbedding: 1 } },
    });
    const text = renderIndex(result, false);
    expect(text.stdout).toContain('Text update: 1 added');
    expect(text.stderr).toContain('Run wiki index to retry');
  });
});

test.each([
  ['status', '--rebuild'],
  ['list', '--rebuild'],
  ['index', '--type', 'doc/guide'],
  ['index', 'extra'],
])('index flags reject unsupported invocation %j', async (...args) => {
  const result = await runCli([...args, '--json']);
  expect(result.exitCode).toBe(1);
  expect(readJson(result.stdout)).toHaveProperty('diagnostics');
});
