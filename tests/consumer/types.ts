import type {
  DocumentSnapshot,
  MetadataFilter,
  SearchHit,
  SearchStore,
  ReferenceOccurrence,
  RelatedResult,
  ValidationResult,
  WikiFrontmatter,
} from 'agent-wiki';

export function referenceTypes(
  result: RelatedResult,
  validation: ValidationResult
): readonly ReferenceOccurrence[] {
  // @ts-expect-error -- Relationship results are immutable.
  result.relationships = [];
  // @ts-expect-error -- Validation selections cannot be mutated by consumers.
  validation.selectedPaths[0] = 'other.md';
  return result.relationships.map((relationship) => relationship.occurrence);
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
