import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  indexWiki,
  indexStatus,
  searchWiki,
  indexPaths,
  openSearchStore,
} from '@rileytomasek/agent-wiki';

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
await writeFile(
  resolve(root, 'excluded.md'),
  '# Excluded\n\nFlowering plants and winter gardening.\n'
);
const indexed = await indexWiki(root, { selections: Object.keys(documents) });
assert.equal(indexed.complete, true, JSON.stringify(indexed.diagnostics));
assert.equal(indexed.embedding?.errors, 0);
assert.equal(indexed.embedding.docsProcessed, 3);
assert.equal((await indexWiki(root)).embedding?.docsProcessed, 0);
assert.equal((await indexStatus(root)).pendingEmbeddings, 0);
const store = await openSearchStore(indexPaths(root));
try {
  const result = await searchWiki(
    root,
    'protect flowering plants during freezing weather',
    {
      store,
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
  const repeated = await searchWiki(
    root,
    'protect flowering plants during freezing weather',
    {
      store,
      filters: { type: 'doc/guide' },
      limit: 2,
    }
  );
  assert.equal(repeated.documents[0]?.path, gardenPath);
  assert.equal(repeated.indexNotice, null);
  await (['keyword', 'semantic', 'hybrid'] as const).reduce(
    async (previous, mode) => {
      await previous;
      const explicit = await searchWiki(root, 'Orchid winter care', {
        store,
        mode,
        filters: { type: 'doc/guide' },
        limit: 2,
      });
      assert.equal(explicit.documents[0]?.path, gardenPath);
      assert.equal(explicit.indexNotice, null);
      assert.ok(explicit.documents.length <= 2);
      assert.equal(explicit.documents[0].snippet.source, 'index');
    },
    Promise.resolve()
  );
} finally {
  await store.close();
}
console.log('Packaged embedding and native hybrid search passed');
