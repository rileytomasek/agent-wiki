import { parseDocument } from '../../src/documents/parse.ts';
import type { MoveFileChange, MovePlan } from '../../src/moves/types.ts';
import { hashSource } from '../../src/workspace/snapshots.ts';
import type { WorkspaceSnapshot } from '../../src/workspace/snapshots.ts';

export function moveWorkspace(
  sources: Readonly<Record<string, string>>,
  attachments: readonly string[] = []
): WorkspaceSnapshot {
  const documents = Object.entries(sources).map(([path, source]) => ({
    source,
    document: parseDocument({ path, source, sourceHash: hashSource(source) }),
  }));
  return {
    root: '/wiki',
    documents,
    files: [...Object.keys(sources), ...attachments],
    documentPaths: Object.keys(sources),
    unavailable: [],
    problems: [],
    complete: true,
    removed: [],
  };
}

export function planChange(plan: MovePlan, path: string): MoveFileChange {
  const change = plan.changes.find((candidate) => candidate.path === path);
  if (change === undefined) throw new Error(`Missing fixture change: ${path}`);
  return change;
}

export function plannedWorkspace(
  workspace: WorkspaceSnapshot,
  plan: MovePlan
): WorkspaceSnapshot {
  const changes = new Map(plan.changes.map((change) => [change.path, change]));
  const sources: Record<string, string> = {};
  for (const { source, document } of workspace.documents) {
    const change = changes.get(document.path);
    sources[change?.destination ?? document.path] = change?.after ?? source;
  }
  const attachments = workspace.files.filter(
    (path) => !workspace.documentPaths.includes(path)
  );
  return moveWorkspace(sources, attachments);
}
