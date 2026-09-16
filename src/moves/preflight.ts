import type { Stats } from 'node:fs';
import { basename, dirname } from 'node:path';

import { OperationError } from '../operations/errors.ts';
import { hashSource, refreshWorkspace } from '../workspace/snapshots.ts';
import { applySourceEdits } from './edits.ts';
import {
  authoredPath,
  checkAncestors,
  sameParent,
  refuseLinkedSources,
} from './file-paths.ts';
import type { MoveIO } from './io.ts';
import { buildMovePlan } from './planning.ts';
import type { MoveFileChange, MovePlan } from './types.ts';

function sameInventory(
  left: readonly string[],
  right: readonly string[]
): boolean {
  const current = new Set(left);
  return (
    current.size === right.length && right.every((path) => current.has(path))
  );
}

function validRename(plan: MovePlan): void {
  const moved = plan.changes.find((change) => change.path === plan.from);
  if (
    moved?.destination !== plan.to ||
    plan.from === plan.to ||
    plan.changes.some(
      (change) =>
        change.path !== plan.from && change.destination !== change.path
    )
  )
    throw new OperationError(
      'move-plan-invalid',
      'The plan must move exactly its named source and only rewrite other files in place.'
    );
}

function validChange(plan: MovePlan, change: MoveFileChange): void {
  authoredPath(plan.root, change.path);
  authoredPath(plan.root, change.destination);
  if (
    plan.fingerprints[change.path] !== change.sourceHash ||
    hashSource(change.before) !== change.sourceHash
  )
    throw new OperationError(
      'move-plan-invalid',
      `Plan has inconsistent source identity: ${change.path}`
    );
  if (applySourceEdits(change.before, change.edits) !== change.after)
    throw new OperationError(
      'move-plan-invalid',
      `Plan content does not match its exact edits: ${change.path}`
    );
}

export async function regularSource(
  plan: MovePlan,
  path: string,
  io: MoveIO
): Promise<Stats> {
  await checkAncestors(plan.root, path, io);
  const info = await io.inspect(authoredPath(plan.root, path));
  if (info?.isFile() !== true)
    throw new OperationError(
      'move-source',
      `Cannot move or rewrite a symlink or non-file source: ${path}`
    );
  return info;
}

async function destinationAvailable(plan: MovePlan, io: MoveIO): Promise<void> {
  await checkAncestors(plan.root, plan.to, io);
  const target = await io.inspect(authoredPath(plan.root, plan.to));
  if (target === null) return;
  const source = await regularSource(plan, plan.from, io);
  const caseOnly =
    plan.from !== plan.to &&
    plan.from.toLowerCase() === plan.to.toLowerCase() &&
    sameParent(plan.from, plan.to);
  if (
    !caseOnly ||
    !target.isFile() ||
    source.ino !== target.ino ||
    source.dev !== target.dev
  )
    throw new OperationError(
      'move-collision',
      `Destination already exists: ${plan.to}`
    );
  const entries = await io.names(dirname(authoredPath(plan.root, plan.to)));
  if (entries.includes(basename(plan.to)))
    throw new OperationError(
      'move-collision',
      `Destination already has its own directory entry: ${plan.to}`
    );
}

function equivalentChanges(expected: MovePlan, actual: MovePlan): boolean {
  const byPath = new Map(
    expected.changes.map((change) => [change.path, change])
  );
  return (
    expected.changes.length === actual.changes.length &&
    actual.changes.every((change) => {
      const current = byPath.get(change.path);
      return (
        current?.destination === change.destination &&
        current.before === change.before &&
        current.after === change.after
      );
    })
  );
}

/** Re-read all potential referrers, not only files the original plan changed. */
export async function verifyMovePlan(
  plan: MovePlan,
  io: MoveIO
): Promise<void> {
  const workspace = await refreshWorkspace(plan.root);
  validRename(plan);
  const expected = Object.keys(plan.fingerprints);
  const unchanged = workspace.documents.every(
    ({ document }) => plan.fingerprints[document.path] === document.sourceHash
  );
  if (
    !workspace.complete ||
    !sameInventory(workspace.files, plan.files) ||
    !sameInventory(workspace.documentPaths, expected) ||
    !unchanged
  )
    throw new OperationError(
      'move-plan-stale',
      'The wiki inventory or source contents changed since this move was planned. Plan the move again.'
    );
  const paths = new Set(plan.changes.map((change) => change.path));
  const destinations = new Set(
    plan.changes.map((change) => change.destination)
  );
  if (
    paths.size !== plan.changes.length ||
    destinations.size !== plan.changes.length
  )
    throw new OperationError(
      'move-plan-invalid',
      'The move plan contains repeated source or destination paths.'
    );
  for (const change of plan.changes) validChange(plan, change);
  if (!equivalentChanges(buildMovePlan(workspace, plan.from, plan.to), plan))
    throw new OperationError(
      'move-plan-invalid',
      'The plan does not match the current complete reference-preserving move.'
    );
  await Promise.all(
    plan.changes.map((change) => regularSource(plan, change.path, io))
  );
  await destinationAvailable(plan, io);
  await refuseLinkedSources(
    plan.root,
    plan.changes.map((change) => change.path),
    workspace.files,
    io
  );
}
