import type { Diagnostic } from '../documents/types.ts';
import { operationProblem } from '../workspace/io.ts';
import { hashSource } from '../workspace/snapshots.ts';
import { inOrder } from './io.ts';
import type { MoveTransaction, StagedChange } from './transaction-types.ts';

async function cleanEntry(
  transaction: MoveTransaction,
  entry: StagedChange
): Promise<void> {
  const { io } = transaction;
  if (entry.staged && (await io.inspect(entry.stage)) !== null)
    await io.unlink(entry.stage);
  const backup = await io.inspect(entry.backup);
  if (backup === null) return;
  if (
    !backup.isFile() ||
    hashSource(await io.read(entry.backup)) !== entry.change.sourceHash
  )
    throw new Error(
      `An original backup changed; kept it for recovery: ${entry.backup}`
    );
  await io.unlink(entry.backup);
}

export async function cleanupMove(
  transaction: MoveTransaction,
  restoreFailed: boolean
): Promise<readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  // A partial rollback retains every backup and staging file for inspection.
  if (restoreFailed) return diagnostics;
  await inOrder(transaction.entries, async (entry) => {
    try {
      await cleanEntry(transaction, entry);
    } catch (error) {
      diagnostics.push(
        operationProblem('move.cleanup', entry.change.path, error)
      );
    }
  });
  return diagnostics;
}

export async function removeCreatedDirectories(
  transaction: MoveTransaction
): Promise<readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  await inOrder(transaction.directories.toReversed(), async (path) => {
    try {
      await transaction.io.rmdir(path);
    } catch (error) {
      diagnostics.push(operationProblem('move.cleanup', path, error));
    }
  });
  return diagnostics;
}

export async function recoveryPaths(
  transaction: MoveTransaction
): Promise<readonly string[]> {
  const paths = transaction.entries.flatMap((entry) => [
    entry.backup,
    entry.stage,
  ]);
  const present = await Promise.all(
    paths.map(async (path) => {
      try {
        return (await transaction.io.inspect(path)) === null ? [] : [path];
      } catch {
        return [path];
      }
    })
  );
  return present.flat();
}
