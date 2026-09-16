import { strict as assert } from 'node:assert';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  hashSource,
  indexStatus,
  listDocuments,
  moveDocument,
  applyMove,
  openSearchStore,
  parseDocument,
  readDocument,
  refreshWorkspace,
  related,
  resolveRoot,
  showDocument,
  validate,
  version,
} from 'agent-wiki';

assert.equal(typeof version, 'string');
const wikiRoot = resolve('wiki');
await mkdir(wikiRoot);
const source = '---\ntype: doc/guide\n---\n# Notes\n\nReadable content.\n';
await writeFile(resolve(wikiRoot, 'notes.md'), source);
assert.equal(await resolveRoot({ cwd: wikiRoot }), wikiRoot);
const parsed = parseDocument({
  path: 'notes.md',
  source,
  sourceHash: hashSource(source),
});
assert.equal(parsed.title, 'Notes');
assert.deepEqual(parsed.diagnostics, []);
assert.equal((await readDocument(wikiRoot, 'notes.md')).source, source);
assert.equal((await refreshWorkspace(wikiRoot)).documents.length, 1);
assert.equal(
  (await listDocuments(wikiRoot, { filters: { type: 'doc/guide' } }))
    .documents[0]?.path,
  'notes.md'
);
assert.equal((await showDocument(wikiRoot, 'notes.md')).content, source);
assert.equal((await indexStatus(wikiRoot)).availability, 'absent');
assert.equal((await related(wikiRoot, 'notes.md')).total, 0);
assert.equal((await validate(wikiRoot)).valid, true);
const preview = await moveDocument(wikiRoot, 'notes.md', 'moved/notes.md', {
  dryRun: true,
});
assert.equal(preview.status, 'dry-run');
assert.equal((await applyMove(preview.plan)).status, 'applied');
assert.equal((await showDocument(wikiRoot, 'moved/notes.md')).content, source);
assert.equal(
  (await moveDocument(wikiRoot, 'moved/notes.md', 'notes.md')).complete,
  true
);
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
