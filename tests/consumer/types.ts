import type {
  DocumentSnapshot,
  IndexResult,
  MetadataFilter,
  SearchHit,
  SearchStore,
  WikiFrontmatter,
} from 'agent-wiki';

export function indexTypes(result: IndexResult): number | undefined {
  // @ts-expect-error -- Index operational results are immutable to consumers.
  result.state.coverage.complete = false;
  return result.state.qmd?.needsEmbedding;
}

export function documentTypes(snapshot: DocumentSnapshot): WikiFrontmatter {
  // @ts-expect-error -- Normalized document identities are immutable to consumers.
  snapshot.document.path = 'other.md';
  const invalid: WikiFrontmatter = {
    // @ts-expect-error -- Authored metadata uses the closed shared schema.
    custom_status: 'active',
  };
  void invalid;
  return snapshot.document.metadata;
}

export function publicTypes(
  store: SearchStore,
  hit: SearchHit
): Promise<readonly SearchHit[]> {
  const filter: MetadataFilter = {
    operator: 'and',
    operands: [
      { key: 'type', operator: 'eq', value: 'doc/guide' },
      { key: 'about', operator: 'all', value: ['projects/wiki.md'] },
    ],
  };
  // @ts-expect-error -- Public search hits are immutable to their consumers.
  hit.path = 'replacement.md';
  const invalid: MetadataFilter = {
    key: 'type',
    // @ts-expect-error -- Metadata predicates require a supported operator.
    operator: 'contains',
    value: 'doc',
  };
  void invalid;
  return store.searchLex(hit.path, { filter, limit: 5 });
}
