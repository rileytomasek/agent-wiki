import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { indexWiki, indexStatus, searchWiki } from '@rileytomasek/agent-wiki';

const root = resolve('model-wiki');
await mkdir(root);
const gardenPath = 'garden %20#café.md';
const documents = {
  [gardenPath]:
    'Orchid winter care. Keep the roots warm indoors. Water sparingly during cold weather and use indirect sunlight.',
  'software.md':
    'Database backup guide. Store a daily SQLite backup on a separate disk. Check restoration regularly.',
  'music.md':
    'Music practice. Learn piano chords and scales with a metronome. Keep a steady rhythm while playing.',
};
await Promise.all(
  Object.entries(documents).map(([path, body]) =>
    writeFile(
      resolve(root, path),
      `---\ntype: doc/guide\n---\n# ${path}\n\n${body}\n`
    )
  )
);
const indexed = await indexWiki(root);
assert.equal(indexed.complete, true, JSON.stringify(indexed.diagnostics));
assert.equal(indexed.embedding?.errors, 0);
assert.equal(indexed.embedding.docsProcessed, 3);
assert.equal((await indexWiki(root)).embedding?.docsProcessed, 0);
assert.equal((await indexStatus(root)).pendingEmbeddings, 0);
const result = await searchWiki(
  root,
  'protect flowering plants during freezing weather',
  {
    filters: { type: 'doc/guide' },
    limit: 2,
  }
);
assert.equal(result.complete, true);
assert.equal(result.documents[0]?.path, gardenPath);
assert.equal(result.documents[0].snippet.source, 'index');
assert.equal(result.indexNotice, null);
assert.ok(result.documents.length <= 2);
assert.ok(
  result.documents.every(
    (document) => document.metadata['type'] === 'doc/guide'
  )
);
console.log('Packaged embedding and native hybrid search passed');
