import { expect, test } from 'vitest';

import { indexWiki } from '../src/search/index.ts';
import { searchWiki } from '../src/search/search.ts';
import { deferEmbeddings } from './fixtures/index.ts';
import { lexicalSearch } from './fixtures/search.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each([
  {
    source: 'Orchid title\n============\n\nOrchid care.\n',
    title: 'Orchid title',
  },
  { source: '# Notes\n\n## Orchid care\n\nOrchid advice.\n', title: 'Notes' },
])(
  'search displays the indexed wiki title: $title',
  async ({ source, title }) => {
    await inWorkspace(async (fixture) => {
      await fixture.write('guide.md', source);
      await indexWiki(fixture.root, { embed: deferEmbeddings });
      const result = await searchWiki(fixture.root, 'orchid', {
        search: lexicalSearch,
      });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]?.title).toBe(title);
      await fixture.write('guide.md', '# Current title\n');
      const stale = await searchWiki(fixture.root, 'orchid', {
        search: lexicalSearch,
      });
      expect(stale.documents[0]?.title).toBe(title);
    });
  }
);

test('search retains the native title when QMD limits omit projected title metadata', async () => {
  await inWorkspace(async (fixture) => {
    const title = 'Orchid'.repeat(200);
    await fixture.write('guide.md', `# ${title}\n\nOrchid care.\n`);
    await indexWiki(fixture.root, { embed: deferEmbeddings });
    const result = await searchWiki(fixture.root, 'orchid', {
      search: lexicalSearch,
    });
    expect(result.documents[0]?.metadata['title']).toBeUndefined();
    expect(result.documents[0]?.title).toBe(title);
  });
});
