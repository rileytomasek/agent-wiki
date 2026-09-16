import { strict as assert } from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  indexPaths,
  indexWiki,
  moveDocument,
  openSearchStore,
  searchWiki,
  validate,
} from '@rileytomasek/agent-wiki';
import type { WikiSearchOptions } from '@rileytomasek/agent-wiki';

const root = resolve('workflow-wiki');
await mkdir(root);
const original = 'guide %20#café.md';
await writeFile(
  resolve(root, original),
  '# Guide\n\n## Care\n\nOrchid winter care.\n'
);
await writeFile(
  resolve(root, 'home.md'),
  '# Home\n\n[Care](guide%20%2520%23caf%C3%A9.md#care)\n'
);
const indexOptions = {
  embed: () =>
    Promise.resolve({ docsProcessed: 0, chunksEmbedded: 0, errors: 0 }),
};
const searchOptions: WikiSearchOptions = {
  search: (store, query, options) => store.searchLex(query, options),
};
const indexed = await indexWiki(root, indexOptions);
assert.equal(indexed.state.coverage.complete, true);
assert.equal(indexed.state.qmd?.needsEmbedding, 2);
assert.equal(
  (await searchWiki(root, 'orchid', searchOptions)).documents[0]?.path,
  original
);
const moved = await moveDocument(root, original, 'archive/guide.md');
assert.equal(moved.complete, true);
assert.equal((await validate(root)).valid, true);
assert.match(
  await readFile(resolve(root, 'home.md'), 'utf8'),
  /archive\/guide\.md#care/u
);
const stale = await searchWiki(root, 'orchid', searchOptions);
assert.equal(stale.documents[0]?.path, original);
assert.notEqual(stale.indexNotice, null);
await indexWiki(root, indexOptions);
const refreshed = await searchWiki(root, 'orchid', searchOptions);
assert.equal(refreshed.documents[0]?.path, 'archive/guide.md');
assert.equal(refreshed.documents[0].snippet.source, 'index');
const selected = await indexWiki(root, {
  ...indexOptions,
  selections: ['archive'],
});
assert.equal(selected.state.coverage.discovered, 1);
assert.deepEqual(selected.state.selections, ['archive']);
const store = await openSearchStore(indexPaths(root));
try {
  const ownedOptions = { ...searchOptions, store };
  const first = await searchWiki(root, 'orchid', ownedOptions);
  const repeated = await searchWiki(root, 'orchid', ownedOptions);
  assert.equal(first.documents[0]?.path, 'archive/guide.md');
  assert.deepEqual(repeated, first);
} finally {
  await store.close();
}
console.log(`Packaged move/index/search workflow passed`);
