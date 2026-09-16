import { posix } from 'node:path';

import { normalizeWikiPath } from '../documents/paths.ts';
import { OperationError } from './errors.ts';

/** Selection limits reported document diagnostics, never the resolution context. */
export function selectedDocuments(
  paths: readonly string[],
  selections: readonly string[],
  complete: boolean
): readonly string[] {
  if (selections.length === 0) return paths.toSorted();
  const selected = new Set<string>();
  for (const selection of selections) {
    const normalized = normalizedSelection(selection);
    const matches = matchingPaths(paths, normalized);
    if (matches.length === 0 && normalized !== '.') {
      const code = complete ? 'selection-unmatched' : 'selection-unavailable';
      throw new OperationError(
        code,
        `No readable Markdown selection could be established for "${selection}".`
      );
    }
    for (const path of matches) selected.add(path);
  }
  return [...selected].toSorted();
}

function normalizedSelection(selection: string): string {
  const normalized = normalizeWikiPath(selection);
  if (selection.trim() === '' || normalized === undefined) {
    throw new OperationError(
      'selection-invalid',
      `Expected a root-relative file, directory or glob: ${selection}`
    );
  }
  return normalized === '.' ? normalized : normalized.replace(/\/$/u, '');
}

function matchingPaths(
  paths: readonly string[],
  selection: string
): readonly string[] {
  if (selection === '.') return paths;
  if (paths.includes(selection)) return [selection];
  const directory = paths.filter((path) => path.startsWith(`${selection}/`));
  return directory.length > 0
    ? directory
    : paths.filter((path) => posix.matchesGlob(path, selection));
}
