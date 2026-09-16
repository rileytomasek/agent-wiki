import { adjacency } from './adjacency.ts';
import { referenceOccurrences, resolutionDiagnostic } from './occurrences.ts';
import { aliasIndex, localTargets } from './targets.ts';
import type { GraphInput, ReferenceGraph } from './types.ts';

/** Rebuild derived targets and adjacency from immutable source-local parses. */
export function buildGraph(input: GraphInput): ReferenceGraph {
  const documents = new Map(
    input.documents.map(({ document }) => [document.path, document])
  );
  const targets = localTargets(input);
  const references = referenceOccurrences({ input, targets });
  for (const occurrence of references) {
    if (occurrence.resolution.status === 'resolved') {
      const { target } = occurrence.resolution;
      targets.set(target.id, target);
    }
  }
  const diagnostics = [
    ...input.documents.flatMap(({ document }) => document.diagnostics),
    ...references.flatMap((occurrence) => resolutionDiagnostic(occurrence)),
  ];
  const problems = input.problems ?? [];
  return {
    documents,
    targets,
    references,
    diagnostics,
    problems,
    aliases: aliasIndex(input),
    ...adjacency(documents, references),
    complete: input.complete !== false && problems.length === 0,
  };
}
