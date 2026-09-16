import { isAbsolute } from 'node:path';

import type { extractSnippet } from '@tobilu/qmd';

import type { Metadata } from './metadata.ts';
import type { SearchHit, SearchStore, StorePaths } from './types.ts';

interface NativeHit {
  readonly title: string;
  readonly score: number;
  readonly metadata: Metadata;
  readonly body?: string;
  readonly bestChunk?: string;
  readonly bestChunkPos?: number;
}

function mapHit(
  hit: NativeHit,
  query: string,
  snippet: typeof extractSnippet
): SearchHit {
  const path = hit.metadata['source_path'];
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Indexed document is missing qmd.metadata.source_path');
  }
  if (hit.body === undefined)
    throw new Error('QMD search result is missing indexed content');
  return {
    path,
    title: hit.title,
    score: hit.score,
    metadata: hit.metadata,
    body: hit.body,
    ...(hit.bestChunk === undefined ? {} : { bestChunk: hit.bestChunk }),
    ...(hit.bestChunkPos === undefined
      ? {}
      : { bestChunkPos: hit.bestChunkPos }),
    snippet: snippet(
      hit.body,
      query,
      undefined,
      hit.bestChunkPos,
      hit.bestChunk?.length
    ).snippet,
  };
}

/** QMD and its native/model dependencies load only when a store is opened. */
export async function openSearchStore(paths: StorePaths): Promise<SearchStore> {
  if (!isAbsolute(paths.dbPath) || !isAbsolute(paths.mirrorPath)) {
    throw new Error('Search database and mirror paths must be absolute');
  }
  const { createStore, extractSnippet: snippet } = await import('@tobilu/qmd');
  const store = await createStore({
    dbPath: paths.dbPath,
    config: {
      collections: { wiki: { path: paths.mirrorPath, pattern: '**/*.md' } },
    },
  });
  return {
    // Always scan the whole collection: QMD infers deletions from missing paths.
    update: () => store.update(),
    embed: () => store.embed(),
    searchLex: async (query, options) => {
      const hits = await store.searchLex(query, options);
      return hits.map((hit) => mapHit(hit, query, snippet));
    },
    search: async (query, options) => {
      const hits = await store.search({ query, ...options });
      return hits.map((hit) => mapHit(hit, query, snippet));
    },
    status: () => store.getStatus(),
    close: () => store.close(),
  };
}
