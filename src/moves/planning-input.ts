import { normalizeWikiPath } from '../documents/paths.ts';
import { OperationError } from '../operations/errors.ts';
import { buildGraph } from '../references/graph.ts';
import { findGraphTarget } from '../references/lookup.ts';
import type { ReferenceGraph } from '../references/types.ts';
import { isDiscoveredPath } from '../workspace/discovery-policy.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshots.ts';
import type { MovePaths } from './destinations.ts';

export function planningInput(
  workspace: WorkspaceSnapshot,
  from: string,
  to: string
): { readonly graph: ReferenceGraph; readonly move: MovePaths } {
  completeReferences(workspace);
  const graph = buildGraph(workspace);
  const move = { from: sourcePath(graph, from), to: destinationPath(to) };
  if (move.from === move.to)
    throw new OperationError(
      'move-same-path',
      'Source and destination are the same path.'
    );
  if (workspace.files.includes(move.to))
    throw new OperationError(
      'move-collision',
      `Destination already exists: ${move.to}`
    );
  return { graph, move };
}

function completeReferences(workspace: WorkspaceSnapshot): void {
  if (!workspace.complete || workspace.problems.length > 0)
    throw new OperationError(
      'move-workspace-incomplete',
      'A move requires a complete current read of every wiki document.'
    );
  const unsafe = workspace.documents
    .filter(({ document }) => !document.referencesComplete)
    .map(({ document }) => document.path);
  if (unsafe.length > 0)
    throw new OperationError(
      'move-reference-incomplete',
      'Some authored references cannot be rewritten safely.',
      unsafe
    );
}

function sourcePath(graph: ReferenceGraph, requested: string): string {
  const lookup = findGraphTarget(graph, requested);
  if (lookup.status === 'ambiguous')
    throw new OperationError(
      'target-ambiguous',
      `Move source is ambiguous: ${requested}`,
      lookup.candidates
    );
  if (lookup.status !== 'resolved')
    throw new OperationError(
      'move-source-missing',
      `Move source was not found: ${requested}`
    );
  if (lookup.target.kind !== 'document')
    throw new OperationError(
      'move-source-invalid',
      'A move source must identify a whole Markdown document.'
    );
  return lookup.target.path;
}

function destinationPath(requested: string): string {
  const path = normalizeWikiPath(requested);
  if (path === undefined || !path.endsWith('.md') || !isDiscoveredPath(path))
    throw new OperationError(
      'move-destination-invalid',
      'The destination must be a visible Markdown path inside the wiki root.'
    );
  return path;
}
