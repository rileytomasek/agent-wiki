import { extractSnippet } from '@tobilu/qmd';
import { expect, test } from 'vitest';

import { openSearchStore } from '../src/search/qmd.ts';
import type { SearchHit } from '../src/search/types.ts';
import { createFixture } from './fixtures/wiki.ts';

function firstHit(hits: readonly SearchHit[]): SearchHit {
  const hit = hits[0];
  if (hit === undefined) throw new Error('Expected a native search result');
  return hit;
}

test('the adapter retains indexed body and delegates ordinary snippets to QMD', async () => {
  const fixture = await createFixture();
  const body = [
    '## 日本語 café',
    '',
    'Orchid advice contains a qualified claim[^source].',
    '',
    ...Array.from({ length: 20 }, () => 'Unrelated paragraph.'),
    '',
    '[^source]: A distant citation definition.',
  ].join('\n');
  await fixture.write('literal %20# café.md', {}, body);
  const store = await openSearchStore(fixture.paths);
  try {
    await store.update();
    const hit = firstHit(await store.searchLex('orchid'));
    expect(hit.path).toBe('literal %20# café.md');
    expect(hit.body).toContain(body);
    expect(hit.snippet).toBe(extractSnippet(hit.body, 'orchid').snippet);
    expect(hit.snippet).toContain('claim[^source]');
    expect(hit.snippet).not.toContain('[^source]:');
    expect(hit.bestChunk).toBeUndefined();
    expect(hit.bestChunkPos).toBeUndefined();
  } finally {
    await store.close();
    await fixture.dispose();
  }
});

test('a metadata-only match preserves the native generated-content snippet', async () => {
  const fixture = await createFixture();
  await fixture.write(
    'document.md',
    { aliases: ['sentinelmetadata'] },
    'Ordinary body.'
  );
  const store = await openSearchStore(fixture.paths);
  try {
    await store.update();
    const hit = firstHit(await store.searchLex('sentinelmetadata'));
    expect(hit.snippet).toBe(
      extractSnippet(hit.body, 'sentinelmetadata').snippet
    );
    expect(hit.snippet).toContain('qmd:');
    expect(hit.snippet).toContain('sentinelmetadata');
    expect(hit.body).toContain('Ordinary body.');
  } finally {
    await store.close();
    await fixture.dispose();
  }
});
