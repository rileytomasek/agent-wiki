import { buildGraph } from '../references/graph.ts';
import { findGraphTarget } from '../references/lookup.ts';
import type { ReferenceGraph, ReferenceTarget } from '../references/types.ts';
import { refreshWorkspace } from '../workspace/snapshots.ts';
import { OperationError } from './errors.ts';
import type {
  RelatedOptions,
  RelatedRelationship,
  RelatedResult,
} from './reference-results.ts';
import { resultLimit } from './results.ts';

export async function related(
  root: string,
  requested: string,
  options: RelatedOptions = {}
): Promise<RelatedResult> {
  const limit = resultLimit(options.limit);
  const graph = buildGraph(await refreshWorkspace(root));
  const target = requestedTarget(graph, requested);
  const relationships = relatedRelationships(graph, target.id);
  const localDiagnostics =
    target.kind === 'external'
      ? []
      : graph.diagnostics.filter(
          (diagnostic) => diagnostic.path === target.path
        );
  return {
    target,
    relationships: relationships.slice(0, limit),
    total: relationships.length,
    truncated: relationships.length > limit,
    diagnostics: [...graph.problems, ...localDiagnostics],
    complete: graph.complete,
  };
}

function requestedTarget(
  graph: ReferenceGraph,
  requested: string
): ReferenceTarget {
  if (requested.trim() === '')
    throw new OperationError(
      'target-empty',
      'A local target or external URL is required.'
    );
  const lookup = findGraphTarget(graph, requested);
  if (lookup.status === 'resolved') return lookup.target;
  if (lookup.status === 'ambiguous')
    throw new OperationError(
      'target-ambiguous',
      `Alias "${requested}" matches several documents.`,
      lookup.candidates
    );
  throw new OperationError(
    `target-${lookup.reason}`,
    `Cannot inspect "${requested}": ${lookup.reason.replaceAll('-', ' ')}.`
  );
}

function relatedRelationships(
  graph: ReferenceGraph,
  id: string
): readonly RelatedRelationship[] {
  const relationships = new Map<string, RelatedRelationship>();
  for (const occurrence of graph.outgoing.get(id) ?? []) {
    relationships.set(occurrence.id, { direction: 'outgoing', occurrence });
  }
  for (const occurrence of graph.incoming.get(id) ?? []) {
    const direction = relationships.has(occurrence.id) ? 'both' : 'incoming';
    relationships.set(occurrence.id, { direction, occurrence });
  }
  return [...relationships.values()].toSorted((left, right) =>
    compareRelationships(left, right)
  );
}

function compareRelationships(
  left: RelatedRelationship,
  right: RelatedRelationship
): number {
  const first = left.occurrence;
  const second = right.occurrence;
  if (first.sourcePath !== second.sourcePath)
    return first.sourcePath < second.sourcePath ? -1 : 1;
  const position = (first.use?.start ?? 0) - (second.use?.start ?? 0);
  if (position !== 0) return position;
  if (first.id === second.id) return 0;
  return first.id < second.id ? -1 : 1;
}
