import { expect, test } from 'vitest';

import { runCli } from '../src/cli/run.ts';
import { indexWiki } from '../src/search/index.ts';
import {
  documentPaths,
  readCommand,
  readJson,
  readObjects,
} from './fixtures/read-cli.ts';
import {
  lexicalSearch,
  prepareSearch,
  searchClock,
  subject,
} from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each(
  [
    ['--json', '--type', 'doc/guide', 'search', 'orchid'],
    ['search', 'orchid', '--json', '--type', 'doc/guide'],
  ].map((args) => ({ args }))
)(
  'search accepts globals and filters on either side: $args',
  async ({ args }) => {
    await inWorkspace(async (fixture) => {
      await prepareSearch(fixture);
      const result = await runCli(
        [...args, '--root', fixture.root, '--limit', '2'],
        { cwd: fixture.root, search: lexicalSearch, clock: searchClock }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      const data = readJson(result.stdout);
      expect(readObjects(data['documents'])).toHaveLength(2);
      expect(data).toMatchObject({
        total: null,
        truncated: null,
        complete: true,
      });
      expect(data['indexNotice']).toMatchObject({
        status: 'incomplete',
        recoveryCommand: 'wiki index',
      });
      expect(result.stdout.split('"indexNotice"')).toHaveLength(2);
    });
  }
);

test('the CLI maps all supported search filters without adding path globs', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const result = await runCli(
      [
        '--root',
        '.',
        'search',
        'orchid',
        '--type',
        'doc/guide',
        '--category',
        'doc',
        '--name',
        'guide',
        '--about',
        subject,
        '--stale',
        '--json',
      ],
      { cwd: fixture.root, search: lexicalSearch, clock: searchClock }
    );
    expect(result.exitCode).toBe(0);
    expect(documentPaths(readJson(result.stdout)).toSorted()).toEqual([
      'guides/literal %20# café.md',
      'guides/old.md',
    ]);
  });
});

test('readable output labels native snippet positions as indexed and emits one state notice', async () => {
  await inWorkspace(async (fixture) => {
    await prepareSearch(fixture);
    const result = await runCli(
      ['search', 'orchid', '--stale', '--limit', '2', '--root', fixture.root],
      { search: lexicalSearch, clock: searchClock }
    );
    expect(result.stdout).toContain('Indexed snippet:');
    expect(result.stdout).toContain('score ');
    expect(result.stdout).toContain('review due ');
    expect(result.stderr.split('Run wiki index')).toHaveLength(2);
    expect(result.stderr).toContain('Search index is incomplete');
    expect(result.exitCode).toBe(0);
  });
});

test('an empty current snapshot produces successful empty JSON without an index notice', async () => {
  await inWorkspace(async (fixture) => {
    await indexWiki(fixture.root);
    const result = await runCli(
      ['search', 'orchid', '--json', '--root', fixture.root],
      { search: lexicalSearch }
    );
    expect(readJson(result.stdout)).toEqual({
      documents: [],
      total: null,
      truncated: null,
      indexNotice: null,
      complete: true,
    });
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });
});

test('the executable rejects missing indexes without loading QMD or hiding recovery instructions', async () => {
  await inWorkspace((fixture) => {
    const result = readCommand(fixture.root, [
      'search',
      'orchid',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const diagnostics = readObjects(readJson(result.stdout)['diagnostics']);
    expect(diagnostics).toMatchObject([
      {
        code: 'search.index-missing',
        message: 'No search index exists. Run wiki index first.',
      },
    ]);
    expect(result.stdout).not.toContain('QMD must not load');
  });
});

test.each(
  [
    ['search'],
    ['search', 'one', 'two'],
    ['search', ''],
    ['search', 'query', '--path', '*.md'],
    ['search', 'query', '--limit', '0'],
    ['search', 'query', '--limit', '-1'],
    ['search', 'query', '--limit', '1.5'],
    ['search', 'query', '--limit', '9007199254740992'],
    ['search', 'query', '--type', ''],
    ['search', 'query', '--about', '../out.md'],
  ].map((args) => ({ args }))
)(
  'invalid search arguments fail before QMD initialization: $args',
  async ({ args }) => {
    await inWorkspace((fixture) => {
      const result = readCommand(fixture.root, [
        ...args,
        '--json',
        '--root',
        fixture.root,
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(readObjects(readJson(result.stdout)['diagnostics'])).toHaveLength(
        1
      );
      expect(result.stdout).not.toContain('QMD must not load');
      expect(result.stdout).not.toContain('No search index exists');
    });
  }
);

test('search help explains native defaults and indexed snippets', async () => {
  const result = await runCli(['search', '--help']);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('indexed');
  expect(result.stdout).toContain('QMD');
  expect(result.stdout).not.toContain('--path');
});
