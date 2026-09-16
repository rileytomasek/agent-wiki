import { selectedDocuments } from '../operations/selections.ts';
import type { Inventory } from '../workspace/discovery.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshots.ts';

function literalPrefix(selection: string): string {
  const segments = selection.split('/');
  const wildcard = segments.findIndex((segment) =>
    ['*', '?', '[', '{', '('].some((token) => segment.includes(token))
  );
  return segments.slice(0, wildcard < 0 ? segments.length : wildcard).join('/');
}

/** Conservatively retain scan gaps wherever a selection could have descendants. */
function mayContain(path: string, selections: readonly string[]): boolean {
  if (path === '' || selections.length === 0) return true;
  return selections.some((selection) => {
    const prefix = literalPrefix(selection);
    return (
      prefix === '' ||
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      prefix.startsWith(`${path}/`)
    );
  });
}

export function selectInventory(
  inventory: Inventory,
  selections: readonly string[]
): Inventory {
  const documentPaths = selectedDocuments(
    inventory.documentPaths,
    selections,
    inventory.complete,
    true
  );
  const selected = new Set(documentPaths);
  const problems = inventory.problems.filter((problem) =>
    problem.code === 'workspace.read'
      ? selected.has(problem.path)
      : mayContain(problem.path, selections)
  );
  return {
    ...inventory,
    documentPaths,
    problems,
    unavailable: inventory.unavailable.filter((path) =>
      mayContain(path, selections)
    ),
    complete: problems.length === 0,
  };
}

export function selectWorkspace(
  workspace: WorkspaceSnapshot,
  selections: readonly string[]
): WorkspaceSnapshot {
  const inventory = selectInventory(workspace, selections);
  const selected = new Set(inventory.documentPaths);
  return {
    ...workspace,
    ...inventory,
    documents: workspace.documents.filter(({ document }) =>
      selected.has(document.path)
    ),
  };
}
