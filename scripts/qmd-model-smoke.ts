import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';

import { openSearchStore } from '../src/index.ts';
import { createFixture } from '../tests/fixtures/wiki.ts';

// Keep downloads reusable but separate from the user's QMD installation.
process.env['XDG_CACHE_HOME'] = resolve('.cache/model-smoke');
const fixture = await createFixture();
const documents = [
  [
    'garden.md',
    'Orchid winter care. Keep the roots warm indoors. Water sparingly during cold weather and use indirect sunlight.',
  ],
  [
    'software.md',
    'Database backup guide. Store a daily SQLite backup on a separate disk. Check restoration regularly.',
  ],
  [
    'music.md',
    'Music practice. Learn piano chords and scales with a metronome. Keep a steady rhythm while playing.',
  ],
];
await Promise.all(
  documents.map(async ([path, body]) => {
    assert.ok(path !== undefined && body !== undefined);
    await fixture.write(path, { type: 'doc/guide' }, body);
  })
);
const store = await openSearchStore(fixture.paths);
try {
  assert.equal((await store.update()).indexed, 3);
  const embedded = await store.embed();
  assert.equal(embedded.errors, 0);
  assert.equal(embedded.docsProcessed, 3);
  assert.ok(embedded.chunksEmbedded >= 3);
  const status = await store.status();
  assert.equal(status.needsEmbedding, 0);
  assert.equal(status.hasVectorIndex, true);
  const hits = await store.search(
    'protect flowering plants during freezing weather',
    {
      filter: { key: 'type', operator: 'eq', value: 'doc/guide' },
      limit: 2,
    }
  );
  assert.equal(hits[0]?.path, 'garden.md');
  assert.ok(hits.every((hit) => hit.metadata['type'] === 'doc/guide'));
  console.log(
    JSON.stringify({ node: process.version, embedded, status, hits }, null, 2)
  );
} finally {
  await store.close();
  await fixture.dispose();
}
