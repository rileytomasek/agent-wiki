import { OperationError } from '../operations/errors.ts';
import { normalizeFilters } from '../operations/filters.ts';
import type { MetadataFilter } from './metadata.ts';
import type { SearchFilters } from './query-types.ts';

/** Translate exact wiki conditions once; native retrieval owns all filtering. */
export function searchFilter(
  input: SearchFilters | undefined,
  today: string
): MetadataFilter | undefined {
  if (input !== undefined && 'path' in input)
    throw new OperationError(
      'filter.unsupported',
      'Search does not support path globs'
    );
  const filters = normalizeFilters(input);
  const operands: MetadataFilter[] = [];
  for (const key of ['type', 'category', 'name', 'about'] as const) {
    const value = filters[key];
    if (value !== undefined) operands.push({ key, operator: 'eq', value });
  }
  if (filters.stale === true)
    operands.push({ key: 'stale_after', operator: 'lte', value: today });
  if (operands.length === 0) return undefined;
  return operands.length === 1 ? operands[0] : { operator: 'and', operands };
}
