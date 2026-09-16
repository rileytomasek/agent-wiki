import { invocationDate } from '../documents/dates.ts';
import type { ParsedDocument } from '../documents/types.ts';
import { refreshWorkspace } from '../workspace/snapshots.ts';
import { matchesFilters, normalizeFilters } from './filters.ts';
import { documentInfo, resultLimit } from './results.ts';
import type { DocumentInfo, ListOptions, ListResult } from './types.ts';

interface Entry {
  readonly document: ParsedDocument;
  readonly info: DocumentInfo;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareEntries(left: Entry, right: Entry, stale: boolean): number {
  if (stale) {
    const deadline = compareText(
      left.info.review.deadline ?? '',
      right.info.review.deadline ?? ''
    );
    if (deadline !== 0) return deadline;
  }
  return compareText(left.info.path, right.info.path);
}

export async function listDocuments(
  root: string,
  options: ListOptions = {}
): Promise<ListResult> {
  const today = invocationDate(options.clock);
  const filters = normalizeFilters(options.filters);
  const limit = resultLimit(options.limit);
  const workspace = await refreshWorkspace(root);
  const matched = workspace.documents
    .map(({ document }) => ({
      document,
      info: documentInfo(document, today),
    }))
    .filter(({ info }) => matchesFilters(info, filters));
  const ordered = matched.toSorted((left, right) =>
    compareEntries(left, right, filters.stale === true)
  );
  const selected = ordered.slice(0, limit);
  return {
    documents: selected.map(({ info }) => info),
    total: matched.length,
    truncated: selected.length < matched.length,
    diagnostics: [
      ...workspace.problems,
      ...selected.flatMap(({ document }) => document.diagnostics),
    ],
    complete: workspace.complete,
  };
}
