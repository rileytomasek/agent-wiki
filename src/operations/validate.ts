import { buildGraph } from '../references/graph.ts';
import { refreshWorkspace } from '../workspace/snapshots.ts';
import type { ValidationResult } from './reference-results.ts';
import { selectedDocuments } from './selections.ts';

export async function validate(
  root: string,
  selections: readonly string[] = []
): Promise<ValidationResult> {
  const workspace = await refreshWorkspace(root);
  const selectedPaths = selectedDocuments(
    workspace.documentPaths,
    selections,
    workspace.complete
  );
  const selected = new Set(selectedPaths);
  const graph = buildGraph(workspace);
  const diagnostics = [
    ...graph.problems,
    ...graph.diagnostics.filter((diagnostic) => selected.has(diagnostic.path)),
  ];
  return {
    selectedPaths,
    diagnostics,
    complete: graph.complete,
    valid:
      graph.complete &&
      !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}
