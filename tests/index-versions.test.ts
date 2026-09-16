import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

import { subprocessEnvironment } from '../scripts/process.ts';
import { qmdRelease } from '../scripts/qmd-release.ts';
import { indexWiki } from '../src/search/index.ts';
import { QMD_BUILD } from '../src/search/projection.ts';
import { readJson } from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

// Hooks export repository selectors; this test's Git repository is independent.
const gitEnvironment = subprocessEnvironment();

test('recorded QMD build identity matches the installed SDK dependency pin', async () => {
  expect(qmdRelease.commit).toBe(QMD_BUILD);
  const mise = await readFile('mise.toml', 'utf8');
  expect(mise).toContain(`version = "${QMD_BUILD}"`);
  expect(mise).toContain(qmdRelease.sha256);
  const manifest = readJson(await readFile('package.json', 'utf8'));
  expect(manifest).toHaveProperty(
    ['dependencies', '@tobilu/qmd'],
    `npm:${qmdRelease.name}@${qmdRelease.version}`
  );
  const installed = readJson(
    await readFile('node_modules/@tobilu/qmd/UPSTREAM.json', 'utf8')
  );
  expect(installed).toMatchObject(qmdRelease);
});

test('new derived cache files are ignored by Git without hiding external observations', async () => {
  await inWorkspace(async (fixture) => {
    expect(
      spawnSync('git', ['init', '--quiet'], {
        cwd: fixture.root,
        env: gitEnvironment,
      }).status
    ).toBe(0);
    await indexWiki(fixture.root);
    const ignored = spawnSync(
      'git',
      ['check-ignore', '.agent-wiki/cache/qmd.sqlite'],
      { cwd: fixture.root, encoding: 'utf8', env: gitEnvironment }
    );
    expect(ignored.status).toBe(0);
    expect(ignored.stdout).toContain('.agent-wiki/cache/qmd.sqlite');
    expect(
      spawnSync(
        'git',
        ['check-ignore', '.agent-wiki/external/observation.json'],
        { cwd: fixture.root, env: gitEnvironment }
      ).status
    ).toBe(1);
  });
});
