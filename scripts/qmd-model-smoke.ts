import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';

import { indexWiki } from '../src/search/index.ts';
import { indexStatus } from '../src/search/status.ts';
import {
  readJson,
  readObject,
  readObjects,
} from '../tests/fixtures/read-cli.ts';
import { inWorkspace } from '../tests/fixtures/workspace.ts';
import { run } from './process.ts';

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

await inWorkspace(async (fixture) => {
  await Promise.all(
    Object.entries(documents).map(([path, body]) =>
      fixture.write(path, `---\ntype: doc/guide\n---\n# ${path}\n\n${body}\n`)
    )
  );
  const indexed = await indexWiki(fixture.root);
  assert.equal(indexed.complete, true);
  assert.equal(indexed.embedding?.errors, 0);
  assert.equal(indexed.embedding.docsProcessed, 3);
  const status = await indexStatus(fixture.root);
  assert.equal(status.status, 'current');
  assert.equal(status.pendingEmbeddings, 0);
  const result = readJson(
    run(
      process.execPath,
      [
        resolve('src/cli/bin.ts'),
        'search',
        'protect flowering plants during freezing weather',
        '--root',
        fixture.root,
        '--type',
        'doc/guide',
        '--limit',
        '2',
        '--json',
      ],
      { cwd: fixture.root }
    )
  );
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
  console.log(
    JSON.stringify(
      { node: process.version, indexed, status, search: result },
      null,
      2
    )
  );
});
