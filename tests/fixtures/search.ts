import { indexPaths } from '../../src/search/index-paths.ts';
import { indexWiki } from '../../src/search/index.ts';
import { openSearchStore } from '../../src/search/qmd.ts';
import type { SearchDocument } from '../../src/search/query-types.ts';
import type {
  SearchHit,
  SearchOptions,
  SearchStore,
} from '../../src/search/types.ts';
import { deferEmbeddings } from './index.ts';
import type { WorkspaceFixture } from './workspace.ts';

export const searchDate = '2026-09-16';
export const subject = 'subjects/literal%20#日本語.md';

export function searchClock(): Date {
  return new Date('2026-09-16T12:00:00');
}

export function firstDocument(
  documents: readonly SearchDocument[]
): SearchDocument {
  const document = documents[0];
  if (document === undefined)
    throw new Error('Expected a wiki search document');
  return document;
}

/** Exercise real QMD retrieval and snippets without model downloads. */
export function lexicalSearch(
  store: SearchStore,
  query: string,
  options: SearchOptions
): Promise<readonly SearchHit[]> {
  return store.searchLex(query, options);
}

export async function nativeSearch(
  root: string,
  options: SearchOptions = {}
): Promise<readonly SearchHit[]> {
  const store = await openSearchStore(indexPaths(root));
  try {
    return await store.searchLex('orchid', options);
  } finally {
    await store.close();
  }
}

const corpus = [
  ['guides/literal %20# café.md', 'doc/guide', '2026-09-16', subject],
  ['guides/old.md', 'doc/guide', '2026-09-15', subject],
  ['guides/future.md', 'doc/guide', '2026-09-17', subject],
  ['guides/undated.md', 'doc/guide', '', subject],
  ['guides/other.md', 'doc/guide', '2026-09-15', 'subjects/other.md'],
  ['notes/note.md', 'doc/note', '2026-09-15', subject],
  ['guides/case.md', 'Doc/guide', '2026-09-15', subject],
];

function guideSource(entry: readonly string[]): {
  readonly path: string;
  readonly source: string;
} {
  const [path, type, deadline, about] = entry;
  if (
    path === undefined ||
    type === undefined ||
    deadline === undefined ||
    about === undefined
  )
    throw new Error('Invalid search fixture');
  return {
    path,
    source: `---\ntype: ${type}\nabout: [${JSON.stringify(`../${about}`)}]\n${deadline === '' ? '' : `stale_after: '${deadline}'\n`}---\n# Indexed ${path}\n\nOrchid knowledge for ${path}.\n`,
  };
}

export async function prepareSearch(fixture: WorkspaceFixture): Promise<void> {
  await Promise.all(
    corpus.map(async (entry) => {
      const { path, source } = guideSource(entry);
      await fixture.write(path, source);
    })
  );
  await fixture.write(subject, '# Principal subject\n');
  await fixture.write('subjects/other.md', '# Other subject\n');
  await indexWiki(fixture.root, { embed: deferEmbeddings, clock: searchClock });
}
