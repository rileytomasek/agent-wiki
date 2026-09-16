import { reviewStatus } from '../documents/dates.ts';
import type { ParsedDocument } from '../documents/types.ts';
import type { DocumentInfo } from './types.ts';

export function documentInfo(
  document: ParsedDocument,
  today: string
): DocumentInfo {
  return {
    path: document.path,
    title: document.title,
    metadata: document.metadata,
    review: reviewStatus(document.metadata.stale_after, today),
  };
}

export function resultLimit(limit: number | undefined): number {
  if (limit === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Limit must be a positive safe integer');
  }
  return limit;
}
