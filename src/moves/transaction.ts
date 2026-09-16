import { readCache, writeCache } from '../workspace/cache.ts';
import { operationProblem } from '../workspace/io.ts';
import { moveOutcomes } from './outcomes.ts';
import { verifyMovePlan } from './preflight.ts';
import type { MoveResult } from './result-types.ts';
import { rollbackMove } from './rollback.ts';
import {
  cleanupMove,
  recoveryPaths,
  removeCreatedDirectories,
} from './transaction-cleanup.ts';
import { commitMove, stageMove } from './transaction-stage.ts';
import type { MoveTransaction } from './transaction-types.ts';
import type { MovePlan } from './types.ts';

async function invalidateParses(plan: MovePlan): Promise<void> {
  const changed = new Set(
    plan.changes.flatMap((change) => [change.path, change.destination])
  );
  const records = await readCache(plan.root);
  await writeCache(
    plan.root,
    records.filter((record) => !changed.has(record.path))
  );
}

async function failedMove(
  transaction: MoveTransaction,
  error: unknown
): Promise<MoveResult> {
  const rollback = await rollbackMove(transaction);
  const partial = rollback.length > 0;
  const cleanup = await cleanupMove(transaction, partial);
  const directories = partial
    ? []
    : await removeCreatedDirectories(transaction);
  return {
    status: partial ? 'partial' : 'rolled-back',
    complete: false,
    plan: transaction.plan,
    diagnostics: [
      ...transaction.plan.diagnostics,
      operationProblem('move.apply', '', error),
      ...rollback,
      ...cleanup,
      ...directories,
    ],
    recoveryPaths: await recoveryPaths(transaction),
    files: await moveOutcomes(transaction.plan, transaction.io),
  };
}

/** Only this function mutates authored files; a multi-file operation is not atomic. */
export async function applyTransaction(
  plan: MovePlan,
  io: MoveTransaction['io']
): Promise<MoveResult> {
  await verifyMovePlan(plan, io);
  const transaction: MoveTransaction = {
    plan,
    io,
    entries: [],
    directories: [],
  };
  try {
    await stageMove(transaction);
    await commitMove(transaction);
  } catch (error) {
    return failedMove(transaction, error);
  }
  const diagnostics = [
    ...plan.diagnostics,
    ...(await cleanupMove(transaction, false)),
  ];
  await invalidateParses(plan);
  const files = await moveOutcomes(plan, io);
  if (
    !files.every(
      (file) =>
        file.state === 'planned' ||
        (file.path === plan.from && file.state === 'missing')
    )
  )
    diagnostics.push(
      operationProblem(
        'move.verification',
        '',
        new Error(
          'Some affected paths changed or could not be read after application. Inspect the per-path outcome states.'
        )
      )
    );
  return {
    status: 'applied',
    complete: diagnostics.length === plan.diagnostics.length,
    plan,
    diagnostics,
    recoveryPaths: await recoveryPaths(transaction),
    files,
  };
}

export async function dryRunTransaction(
  plan: MovePlan,
  io: MoveTransaction['io']
): Promise<MoveResult> {
  await verifyMovePlan(plan, io);
  const files = await moveOutcomes(plan, io);
  const complete = files.every(
    (file) => file.state === (file.path === plan.to ? 'missing' : 'original')
  );
  const diagnostics = complete
    ? plan.diagnostics
    : [
        ...plan.diagnostics,
        operationProblem(
          'move.verification',
          '',
          new Error(
            'Some affected paths changed or could not be read while preparing the preview. Plan the move again.'
          )
        ),
      ];
  return {
    status: 'dry-run',
    complete,
    plan,
    diagnostics,
    recoveryPaths: [],
    files,
  };
}
