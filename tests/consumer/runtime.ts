import { strict as assert } from 'node:assert';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { openSearchStore, version } from 'agent-wiki';

assert.equal(typeof version, 'string');
const mirrorPath = resolve('mirror');
await mkdir(mirrorPath);
const path = 'literal café %20#[a].md';
const documentPath = resolve(mirrorPath, path);
await writeFile(
  documentPath,
  `---\nqmd:\n  metadata: ${JSON.stringify({
    source_path: path,
    type: 'doc/guide',
  })}\n---\n# Orchids\n\nKeep orchid roots warm.\n`
);
const store = await openSearchStore({
  dbPath: resolve('index.sqlite'),
  mirrorPath,
});
try {
  assert.equal((await store.update()).indexed, 1);
  const hits = await store.searchLex('orchid', {
    filter: { key: 'type', operator: 'eq', value: 'doc/guide' },
  });
  assert.equal(hits[0]?.path, path);
  assert.equal((await store.status()).needsEmbedding, 1);
  await rm(documentPath);
  assert.equal((await store.update()).removed, 1);
} finally {
  await store.close();
}
console.log(`Node ${process.version}: packaged SDK metadata/lifecycle passed`);
