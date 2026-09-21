import { strict as assert } from 'node:assert';
import { mock } from 'node:test';

import { createStore } from '@tobilu/qmd';

import { indexPaths } from '../src/search/index-paths.ts';
import { qmdSearch } from '../src/search/qmd-search.ts';

function forbiddenInference(): never {
  throw new Error('Unexpected expansion or reranking in a fast search mode');
}

/** Observe native inference only in this integration proof, never in shipped code. */
export async function proveSearchModes(root: string): Promise<void> {
  const paths = indexPaths(root);
  const store = await createStore({
    dbPath: paths.dbPath,
    config: {
      collections: { wiki: { path: paths.mirrorPath, pattern: '**/*.md' } },
    },
  });
  try {
    const llm = store.internal.llm;
    assert.ok(llm);
    const embed = mock.method(llm, 'embed');
    const batch = mock.method(llm, 'embedBatch');
    const expand = mock.method(llm, 'expandQuery', forbiddenInference);
    const rerank = mock.method(llm, 'rerank', forbiddenInference);
    const keyword = await qmdSearch(store, 'orchid', { mode: 'keyword' });
    assert.ok(keyword.length > 0);
    assert.equal(embed.mock.callCount() + batch.mock.callCount(), 0);
    const query = 'How can flowering plants survive cold weather?';
    const semantic = await qmdSearch(store, query, {
      mode: 'semantic',
      limit: 2,
    });
    assert.equal(
      semantic[0]?.metadata['source_path'],
      'guides/garden %20#café.md'
    );
    assert.equal(batch.mock.callCount(), 1);
    assert.equal(expand.mock.callCount(), 0);
    assert.equal(rerank.mock.callCount(), 0);
    expand.mock.restore();
    rerank.mock.restore();
    const fullRerank = mock.method(llm, 'rerank');
    const hybrid = await qmdSearch(store, query, { mode: 'hybrid', limit: 2 });
    assert.equal(
      hybrid[0]?.metadata['source_path'],
      'guides/garden %20#café.md'
    );
    assert.equal(fullRerank.mock.callCount(), 1);
    console.log(
      'PASS native inference proof: keyword uses no models; semantic embeds without expansion/reranking; hybrid reranks.'
    );
  } finally {
    mock.restoreAll();
    await store.close();
  }
}
