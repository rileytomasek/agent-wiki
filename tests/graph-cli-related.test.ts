import { expect, test } from 'vitest';

import { runCli } from '../src/cli/run.ts';
import { readCommand, readJson, readObjects } from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('related returns located incoming and outgoing relationships with limits', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'a.md',
      '# A\n\n[B](b.md#details) and [B again](b.md#details).\n'
    );
    await fixture.write('b.md', '# B\n\n## Details\n\n[A](a.md)\n');
    const result = readCommand(fixture.root, [
      'related',
      'b.md',
      '--limit',
      '1',
      '--json',
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(readJson(result.stdout)).toMatchObject({
      total: 3,
      truncated: true,
      complete: true,
    });
    expect(readObjects(readJson(result.stdout)['relationships'])).toHaveLength(
      1
    );
    const text = readCommand(fixture.root, ['related', 'b.md']);
    expect(text.status).toBe(0);
    expect(text.stdout).toContain('incoming');
    expect(text.stdout).toContain('outgoing');
    expect(text.stdout).toContain('a.md');
    expect(text.stdout).toContain('link');
  });
});

test('GitHub URL lookup converges incoming references without fetching anything', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'a.md',
      '# A\n\n[Review](https://github.com/owner/repo/pull/12#discussion_r1)\n'
    );
    await fixture.write(
      'b.md',
      '---\nurl: https://github.com/owner/repo/pull/12\n---\n# B\n'
    );
    const result = readCommand(fixture.root, [
      'related',
      'https://github.com/owner/repo/pull/12',
      '--json',
    ]);
    expect(result.status).toBe(0);
    expect(readJson(result.stdout)).toMatchObject({
      total: 2,
      complete: true,
      truncated: false,
    });
    const relationships = readObjects(readJson(result.stdout)['relationships']);
    expect(
      relationships.every((item) => item['direction'] === 'incoming')
    ).toBe(true);
  });
});

test('related supports attachments and an empty existing document', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a.md', '# A\n\n![Map](map.svg)\n');
    await fixture.write('map.svg', '<svg/>');
    await fixture.write('empty.md', '# Empty\n');
    const image = readCommand(fixture.root, ['related', 'map.svg', '--json']);
    expect(image.status).toBe(0);
    expect(readJson(image.stdout)['total']).toBe(1);
    const empty = await runCli(['related', 'empty.md', '--json'], {
      cwd: fixture.root,
    });
    expect(empty.exitCode).toBe(0);
    expect(readJson(empty.stdout)).toMatchObject({
      relationships: [],
      total: 0,
      complete: true,
    });
  });
});

test('ambiguous aliases report every candidate', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a.md', '---\naliases: [Shared]\n---\n# A\n');
    await fixture.write('b.md', '---\naliases: [Shared]\n---\n# B\n');
    const result = readCommand(fixture.root, ['related', 'Shared', '--json']);
    expect(result.status).toBe(1);
    expect(readJson(result.stdout)['candidates']).toEqual(['a.md', 'b.md']);
  });
});

test.each([
  [],
  ['missing.md'],
  ['a.md', 'extra'],
  ['a.md', '--type', 'doc'],
  ['a.md', '--limit', '0'],
])(
  'related errors do not look like successful empty results: %s',
  async (...args) => {
    await inWorkspace(async (fixture) => {
      await fixture.write('a.md', '# A\n');
      const result = readCommand(fixture.root, ['related', ...args, '--json']);
      expect(result.status).toBe(1);
      expect(
        readObjects(readJson(result.stdout)['diagnostics']).length
      ).toBeGreaterThan(0);
      expect(readJson(result.stdout)).not.toHaveProperty('relationships');
    });
  }
);
