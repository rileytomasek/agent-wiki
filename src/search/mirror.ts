import type { Diagnostic } from '../documents/types.ts';
import { ensureDirectory } from '../workspace/derived.ts';
import { confirmsAbsence, discoverWorkspace } from '../workspace/discovery.ts';
import { operationProblem } from '../workspace/io.ts';
import { readFiles } from '../workspace/read-files.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshots.ts';
import type { IndexCoverage, TextBaseline } from './index-types.ts';
import { removeMirrorDocument, writeMirrorDocument } from './mirror-files.ts';
import type { PreparedMirror } from './mirror-projection.ts';
import { verifyMirror } from './mirror-safety.ts';

export interface MirrorResult {
  readonly coverage: IndexCoverage;
  readonly diagnostics: readonly Diagnostic[];
  readonly safeToUpdate: boolean;
}

async function updateCopies(
  root: string,
  prepared: PreparedMirror
): Promise<readonly Diagnostic[]> {
  const documents = new Map(
    prepared.documents.map((document) => [document.path, document])
  );
  const results = await readFiles([...documents.keys()], async (path) => {
    const document = documents.get(path);
    if (document === undefined)
      throw new Error('Missing prepared mirror document');
    try {
      await writeMirrorDocument(root, document);
      return null;
    } catch (error) {
      return operationProblem('index.mirror', path, error);
    }
  });
  return results.filter((problem) => problem !== null);
}

async function removeCopies(
  root: string,
  workspace: WorkspaceSnapshot
): Promise<readonly Diagnostic[]> {
  const mirror = await discoverWorkspace(root);
  const absent = mirror.documentPaths.filter((path) =>
    confirmsAbsence(path, workspace)
  );
  const results = await readFiles(absent, async (path) => {
    try {
      await removeMirrorDocument(root, path);
      return null;
    } catch (error) {
      return operationProblem('index.mirror', path, error);
    }
  });
  return [...mirror.problems, ...results.filter((problem) => problem !== null)];
}

async function retainedCopies(
  root: string,
  workspace: WorkspaceSnapshot,
  previous: TextBaseline | null
): Promise<boolean> {
  const mirror = await discoverWorkspace(root);
  if (!mirror.complete || (!workspace.complete && previous === null))
    return false;
  const files = new Set(mirror.documentPaths);
  return (
    previous?.sources.every(
      (source) =>
        confirmsAbsence(source.path, workspace) || files.has(source.path)
    ) ?? true
  );
}

export async function reconcileMirror(
  root: string,
  workspace: WorkspaceSnapshot,
  prepared: PreparedMirror,
  previous: TextBaseline | null
): Promise<MirrorResult> {
  await ensureDirectory(root);
  await verifyMirror(root);
  const failures = [
    ...(await removeCopies(root, workspace)),
    ...(await updateCopies(root, prepared)),
  ];
  const safeToUpdate = await retainedCopies(root, workspace, previous);
  await verifyMirror(root);
  if (!safeToUpdate)
    failures.push(
      operationProblem(
        'index.coverage',
        '',
        new Error(
          'Cannot establish retained copies for a complete QMD update; the existing index was preserved. Retry wiki index after restoring readable sources.'
        )
      )
    );
  return {
    coverage: {
      ...prepared.coverage,
      complete: prepared.coverage.complete && failures.length === 0,
    },
    diagnostics: [...prepared.diagnostics, ...failures],
    safeToUpdate,
  };
}
