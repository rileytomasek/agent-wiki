import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexWiki } from '../src/search/index.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each([
  ['guide.md', 'guide.md/deep/nested.md'],
  ['guide.md/deep/nested.md', 'guide.md'],
])(
  'a source path changing from %s to %s reconciles in one update',
  async (previous, replacement) => {
    await inWorkspace(async (fixture) => {
      await fixture.write(previous, '# Previous\n\nOrchid original.\n');
      await indexWiki(fixture.root, { embed: deferEmbeddings });
      await rm(join(fixture.root, 'guide.md'), { recursive: true });
      await fixture.write(
        replacement,
        '# Replacement\n\nCobalt replacement.\n'
      );
      const result = await indexWiki(fixture.root, { embed: deferEmbeddings });
      expect(result.update).toMatchObject({
        indexed: 1,
        removed: 1,
        skipped: 0,
      });
      expect(result.state.coverage).toMatchObject({
        projected: 1,
        complete: true,
      });
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        'index.embeddings',
      ]);
      expect(await indexedHits(fixture.root, 'orchid')).toEqual([]);
      expect(
        (await indexedHits(fixture.root, 'cobalt')).map((hit) => hit.path)
      ).toEqual([replacement]);
    });
  }
);
