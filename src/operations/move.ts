import { moveFilesystem } from '../moves/io.ts';
import { buildMovePlan } from '../moves/planning.ts';
import type { MoveOptions, MoveResult } from '../moves/result-types.ts';
import { applyTransaction, dryRunTransaction } from '../moves/transaction.ts';
import type { MovePlan } from '../moves/types.ts';
import { operationProblem } from '../workspace/io.ts';
import { refreshWorkspace } from '../workspace/snapshots.ts';
import { acquireWorkspaceLock } from '../workspace/write-lock.ts';
import { OperationError } from './errors.ts';

/** Refresh, plan and optionally apply while holding the same writer lock as index. */
export async function moveDocument(
  root: string,
  from: string,
  to: string,
  options: MoveOptions = {}
): Promise<MoveResult> {
  return lockedMove(root, async () => {
    const workspace = await refreshWorkspace(root);
    const plan = buildMovePlan(workspace, from, to);
    return performMove(plan, options);
  });
}

/** Apply a previously reviewed plan only after rechecking its full source inventory. */
export async function applyMove(
  plan: MovePlan,
  options: MoveOptions = {}
): Promise<MoveResult> {
  return lockedMove(plan.root, () => performMove(plan, options));
}

async function performMove(
  plan: MovePlan,
  options: MoveOptions
): Promise<MoveResult> {
  const io = options.io ?? moveFilesystem;
  return options.dryRun === true
    ? dryRunTransaction(plan, io)
    : applyTransaction(plan, io);
}

async function lockedMove(
  root: string,
  action: () => Promise<MoveResult>
): Promise<MoveResult> {
  const lock = await acquireWorkspaceLock(root);
  let result: MoveResult;
  try {
    result = await action();
  } catch (error) {
    await lock.release().catch((releaseError: unknown) => {
      const failures = [error, releaseError].map((failure) =>
        failure instanceof Error ? failure.message : String(failure)
      );
      throw new OperationError('move-lock-release', failures.join('\n'));
    });
    throw error;
  }
  try {
    await lock.release();
    return result;
  } catch (error) {
    return {
      ...result,
      complete: false,
      diagnostics: [
        ...result.diagnostics,
        operationProblem('move.lock-release', root, error),
      ],
    };
  }
}
