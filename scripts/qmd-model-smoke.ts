import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import {
  readJson,
  readObject,
  readObjects,
} from '../tests/fixtures/read-cli.ts';
import { inWorkspace } from '../tests/fixtures/workspace.ts';
import { run } from './process.ts';
import { proveSearchModes } from './qmd-mode-proof.ts';

// Keep downloads reusable but separate from the user's QMD installation.
process.env['XDG_CACHE_HOME'] = resolve('.cache/model-smoke');
const gardenPath = 'guides/garden %20#café.md';
const documents: Readonly<Record<string, string>> = {
  [gardenPath]:
    'Orchid winter care. Keep the roots warm indoors. Water sparingly during cold weather and use indirect sunlight.',
  'software.md':
    'Database backup guide. Store a daily SQLite backup on a separate disk. Check restoration regularly.',
  'music.md':
    'Music practice. Learn piano chords and scales with a metronome. Keep a steady rhythm while playing.',
};

function command(root: string, args: readonly string[]) {
  const start = performance.now();
  const result = readJson(
    run(
      process.execPath,
      [resolve('src/cli/bin.ts'), ...args, '--root', root, '--json'],
      { cwd: root }
    )
  );
  return { result, milliseconds: Math.round(performance.now() - start) };
}

function assertSearch(result: Readonly<Record<string, unknown>>): void {
  const hits = readObjects(result['documents']);
  const first = readObject(hits[0]);
  assert.equal(first['path'], gardenPath);
  assert.equal(readObject(first['snippet'])['source'], 'index');
  assert.equal(typeof readObject(first['snippet'])['text'], 'string');
  assert.equal(typeof first['score'], 'number');
  assert.ok(
    hits.every((hit) => readObject(hit['metadata'])['type'] === 'doc/guide')
  );
  assert.ok(hits.length <= 2);
  assert.equal(result['indexNotice'], null);
  assert.equal(result['total'], null);
  assert.equal(result['truncated'], null);
  assert.equal(result['complete'], true);
}

await inWorkspace(async (fixture) => {
  await Promise.all(
    Object.entries(documents).map(([path, body]) =>
      fixture.write(path, `---\ntype: doc/guide\n---\n# ${path}\n\n${body}\n`)
    )
  );
  const indexed = command(fixture.root, ['index']);
  assert.equal(indexed.result['complete'], true);
  assert.equal(readObject(indexed.result['embedding'])['errors'], 0);
  assert.equal(readObject(indexed.result['embedding'])['docsProcessed'], 3);
  const repeated = await indexWiki(fixture.root);
  assert.equal(repeated.complete, true);
  assert.equal(repeated.embedding?.docsProcessed, 0);
  const status = await indexStatus(fixture.root);
  assert.equal(status.status, 'current');
  assert.equal(status.pendingEmbeddings, 0);
  const search = command(fixture.root, [
    'search',
    'protect flowering plants during freezing weather',
    '--type',
    'doc/guide',
    '--limit',
    '2',
  ]);
  assertSearch(search.result);
  await proveSearchModes(fixture.root);
  console.log(
    JSON.stringify(
      {
        node: process.version,
        models: 'cached local models; process startup included',
        indexed,
        repeated,
        status,
        search,
      },
      null,
      2
    )
  );
});
