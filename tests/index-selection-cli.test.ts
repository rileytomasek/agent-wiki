import { spawnSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { expect, test } from 'vitest';

import { indexPaths, indexWiki, searchWiki } from '../src/index.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { readCommand, readJson } from './fixtures/read-cli.ts';
import { lexicalSearch } from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

function indexCommand(root: string, operands: readonly string[]) {
  return spawnSync(
    process.execPath,
    [resolve('src/cli/bin.ts'), '--root', root, 'index', ...operands, '--json'],
    { encoding: 'utf8', timeout: 20_000 }
  );
}

test('CLI recovery supplies an explicit scope without indexing unrelated repository documents', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('records/one.md', '# Record\n\nOrchid record.\n');
    await fixture.write('outside.md', '# Outside\n\nCobalt excluded.\n');
    await indexWiki(fixture.root, {
      selections: ['records'],
      embed: deferEmbeddings,
    });
    await rm(join(fixture.root, 'records/one.md'));
    await writeFile(indexPaths(fixture.root).statePath, '{broken');
    const stale = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
    });
    expect(stale.documents[0]?.path).toBe('records/one.md');
    expect(stale.indexNotice?.currency).toBe('unknown');
    expect(stale.indexNotice?.recoveryCommand).toBe(
      'wiki index --rebuild <selections...>'
    );
    expect(readCommand(fixture.root, ['status']).stdout).toContain(
      'wiki index --rebuild <selections...>'
    );
    const refused = indexCommand(fixture.root, ['--rebuild']);
    expect(refused.status).toBe(1);
    expect(readJson(refused.stdout)).toMatchObject({
      diagnostics: [{ code: 'index.selection-unknown' }],
    });
    const recovered = indexCommand(fixture.root, ['--rebuild', 'records']);
    expect(recovered.status).toBe(0);
    expect(readJson(recovered.stdout)).toMatchObject({
      complete: true,
      state: { selections: ['records'], qmd: { totalDocuments: 0 } },
    });
  });
});

test('CLI dot selection explicitly recovers whole-root indexing after missing scope state', async () => {
  await inWorkspace(async (fixture) => {
    await indexWiki(fixture.root, { selections: ['records'] });
    await rm(indexPaths(fixture.root).statePath);
    const recovered = indexCommand(fixture.root, ['--rebuild', '.']);
    expect(recovered.status).toBe(0);
    expect(readJson(recovered.stdout)).toMatchObject({
      complete: true,
      state: { selections: [], qmd: { totalDocuments: 0 } },
    });
    expect(readCommand(fixture.root, ['index', '--help']).stdout).toContain(
      'files | directories | globs'
    );
  });
});

const damagedDatabases = [
  { name: 'missing', damage: (path: string) => rm(path) },
  {
    name: 'corrupt',
    damage: (path: string) => writeFile(path, 'corrupt SQLite'),
  },
];

test.each(damagedDatabases)(
  'CLI recovery stays actionable with corrupt scope and a $name database',
  async ({ damage }) => {
    await inWorkspace(async (fixture) => {
      await indexWiki(fixture.root, { selections: ['records'] });
      const paths = indexPaths(fixture.root);
      await writeFile(paths.statePath, '{broken');
      await damage(paths.dbPath);
      expect(readCommand(fixture.root, ['status']).stdout).toContain(
        'wiki index --rebuild <selections...>'
      );
      const refused = indexCommand(fixture.root, ['--rebuild']);
      expect(refused.status).toBe(1);
      expect(readJson(refused.stdout)).toMatchObject({
        diagnostics: [{ code: 'index.selection-unknown' }],
      });
      const recovered = indexCommand(fixture.root, ['--rebuild', 'records']);
      expect(recovered.status).toBe(0);
      expect(readJson(recovered.stdout)).toMatchObject({
        complete: true,
        state: { selections: ['records'] },
      });
    });
  }
);
