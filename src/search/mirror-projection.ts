import type { Diagnostic } from '../documents/types.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshots.ts';
import type { IndexCoverage, SourceFingerprint } from './index-types.ts';
import { projectDocument } from './projection.ts';

export interface MirrorDocument {
  readonly path: string;
  readonly content: string;
}

export interface PreparedMirror {
  readonly documents: readonly MirrorDocument[];
  readonly sources: readonly SourceFingerprint[];
  readonly coverage: IndexCoverage;
  readonly diagnostics: readonly Diagnostic[];
}

export function prepareMirror(workspace: WorkspaceSnapshot): PreparedMirror {
  const diagnostics = [...workspace.problems];
  const documents: MirrorDocument[] = [];
  for (const snapshot of workspace.documents) {
    const projection = projectDocument(snapshot);
    diagnostics.push(
      ...snapshot.document.diagnostics,
      ...projection.diagnostics
    );
    if (projection.content !== undefined)
      documents.push({
        path: snapshot.document.path,
        content: projection.content,
      });
  }
  return {
    documents,
    sources: workspace.documents.map(({ document }) => ({
      path: document.path,
      hash: document.sourceHash,
    })),
    coverage: {
      discovered: workspace.documentPaths.length,
      readable: workspace.documents.length,
      projected: documents.length,
      complete:
        workspace.complete && documents.length === workspace.documents.length,
    },
    diagnostics,
  };
}
