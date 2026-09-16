import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

import { indexWiki } from '../src/search/index.ts';
import { QMD_BUILD } from '../src/search/projection.ts';
import { readJson } from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('recorded QMD build identity matches the installed SDK dependency pin', async () => {
  const manifest = readJson(await readFile('package.json', 'utf8'));
  expect(manifest).toHaveProperty(
    ['dependencies', '@tobilu/qmd'],
    `git+https://github.com/tobi/qmd.git#${QMD_BUILD}`
  );
});

test('new derived cache files are ignored by Git without hiding external observations', async () => {
  await inWorkspace(async (fixture) => {
    expect(
      spawnSync('git', ['init', '--quiet'], { cwd: fixture.root }).status
    ).toBe(0);
    await indexWiki(fixture.root);
    const ignored = spawnSync(
      'git',
      ['check-ignore', '.agent-wiki/cache/qmd.sqlite'],
      { cwd: fixture.root, encoding: 'utf8' }
    );
    expect(ignored.status).toBe(0);
    expect(ignored.stdout).toContain('.agent-wiki/cache/qmd.sqlite');
    expect(
      spawnSync(
        'git',
        ['check-ignore', '.agent-wiki/external/observation.json'],
        { cwd: fixture.root }
      ).status
    ).toBe(1);
  });
});
