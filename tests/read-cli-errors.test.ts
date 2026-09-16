import { expect, test } from 'vitest';

import {
  readCommand,
  readJson,
  readObjects,
  readString,
} from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each([
  { command: 'show', operands: ['broken.md'] },
  { command: 'list', operands: [] },
])(
  'content diagnostics do not prevent usable $command output',
  async ({ command, operands }) => {
    await inWorkspace(async (fixture) => {
      await fixture.write(
        'broken.md',
        '---\nemail: broken\nunknown_key: value\n---\n# One\n\n# Two\n\nStill readable.\n'
      );
      const result = readCommand(fixture.root, [
        command,
        ...operands,
        '--json',
        '--root',
        fixture.root,
      ]);
      expect(result.status).toBe(0);
      const data = readJson(result.stdout);
      expect(data['complete']).toBe(true);
      expect(
        readObjects(data['diagnostics']).map((diagnostic) =>
          readString(diagnostic['code'])
        )
      ).toEqual(
        expect.arrayContaining([
          'frontmatter-value',
          'frontmatter-unknown',
          'markdown-title-count',
        ])
      );
      expect(result.stderr).not.toContain('QMD');
    });
  }
);

test.each([
  ['show', 'missing.md'],
  ['show', 'exists.md#missing'],
  ['show'],
  ['show', 'exists.md', 'extra'],
  ['list', 'unexpected'],
  ['list', '--limit', '-1'],
  ['list', '--limit', '0'],
  ['list', '--limit', '1.5'],
  ['list', '--limit', 'many'],
  ['show', 'exists.md', '--path', '*.md'],
  ['list', '--unknown'],
])(
  'operational and argument failures are structured nonzero JSON: %s',
  async (...args) => {
    await inWorkspace(async (fixture) => {
      await fixture.write('exists.md', '# Existing\n');
      const result = readCommand(fixture.root, [
        ...args,
        '--json',
        '--root',
        fixture.root,
      ]);
      expect(result.status).toBe(1);
      const data = readJson(result.stdout);
      const diagnostics = readObjects(data['diagnostics']);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(readString(diagnostics[0]?.['message']).length).toBeGreaterThan(0);
      expect(data).not.toHaveProperty('documents');
      expect(data).not.toHaveProperty('document');
    });
  }
);

test('an unavailable root is a failure while an empty wiki is successful', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('empty-directory');
    const missing = readCommand(fixture.root, [
      'list',
      '--json',
      '--root',
      'missing-root',
    ]);
    expect(missing.status).toBe(1);
    expect(
      readObjects(readJson(missing.stdout)['diagnostics']).length
    ).toBeGreaterThan(0);
    const empty = readCommand(fixture.root, [
      'list',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(empty.status).toBe(0);
    expect(readJson(empty.stdout)).toMatchObject({
      documents: [],
      total: 0,
      complete: true,
    });
  });
});

test('text errors use stderr and do not masquerade as empty successful output', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('exists.md');
    const result = readCommand(fixture.root, [
      'show',
      'missing.md',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('missing.md');
  });
});

test('show rejects an explicit path into derived cache content', async () => {
  await inWorkspace(async (fixture) => {
    const path = '.agent-wiki/cache/derived.md';
    await fixture.write(path, '# Derived cache copy\n');
    const result = readCommand(fixture.root, [
      'show',
      path,
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(1);
    const data = readJson(result.stdout);
    expect(readObjects(data['diagnostics']).length).toBeGreaterThan(0);
    expect(data).not.toHaveProperty('content');
  });
});
