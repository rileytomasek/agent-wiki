import type { DocumentSnapshot } from '../documents/types.ts';
import type { ReferenceGraph } from '../references/types.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshots.ts';
import { referenceEdit } from './destinations.ts';
import type { MovePaths } from './destinations.ts';
import { applySourceEdits, normalizeEdits } from './edits.ts';
import type { SourceEdit } from './edits.ts';
import { planningInput } from './planning-input.ts';
import { verifyPlannedChange } from './planning-verification.ts';
import type { MoveFileChange, MovePlan } from './types.ts';

/** Plan a complete exact-span rewrite using only the supplied current snapshot. */
export function buildMovePlan(
  workspace: WorkspaceSnapshot,
  from: string,
  to: string
): MovePlan {
  const { graph, move } = planningInput(workspace, from, to);
  const edits = referenceEdits(workspace, graph, move);
  const changes: MoveFileChange[] = [];
  for (const snapshot of workspace.documents) {
    const path = snapshot.document.path;
    const patches = edits.get(path) ?? [];
    if (path !== move.from && patches.length === 0) continue;
    const change = fileChange(snapshot, patches, move);
    verifyPlannedChange(snapshot, change, move);
    changes.push(change);
  }
  return {
    root: workspace.root,
    ...move,
    changes: changes.toSorted((left, right) =>
      left.path < right.path ? -1 : 1
    ),
    fingerprints: Object.fromEntries(
      workspace.documents.map(({ document }) => [
        document.path,
        document.sourceHash,
      ])
    ),
    files: workspace.files.toSorted(),
    diagnostics: graph.diagnostics,
  };
}

function referenceEdits(
  workspace: WorkspaceSnapshot,
  graph: ReferenceGraph,
  move: MovePaths
): ReadonlyMap<string, readonly SourceEdit[]> {
  const sources = new Map(
    workspace.documents.map((snapshot) => [
      snapshot.document.path,
      snapshot.source,
    ])
  );
  const edits = new Map<string, SourceEdit[]>();
  for (const occurrence of graph.references) {
    const source = sources.get(occurrence.sourcePath);
    if (source === undefined) continue;
    const edit = referenceEdit(occurrence, source, move);
    if (edit === undefined) continue;
    const previous = edits.get(occurrence.sourcePath) ?? [];
    previous.push(edit);
    edits.set(occurrence.sourcePath, previous);
  }
  return edits;
}

function fileChange(
  snapshot: DocumentSnapshot,
  patches: readonly SourceEdit[],
  move: MovePaths
): MoveFileChange {
  const { path, sourceHash } = snapshot.document;
  const edits = normalizeEdits(snapshot.source, patches);
  return {
    path,
    destination: path === move.from ? move.to : path,
    before: snapshot.source,
    after: applySourceEdits(snapshot.source, edits),
    sourceHash,
    edits,
  };
}
