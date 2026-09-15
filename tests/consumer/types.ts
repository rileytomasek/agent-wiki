import type { MetadataFilter, SearchHit, SearchStore } from 'agent-wiki';

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
