import type { Stats } from 'node:fs';

import type { Diagnostic } from '../documents/types.ts';
import { operationProblem } from '../workspace/io.ts';
import { hashSource } from '../workspace/snapshots.ts';
import { inOrder } from './io.ts';
import type { MoveIO } from './io.ts';
import type { MoveTransaction, StagedChange } from './transaction-types.ts';

function sameFile(left: Stats | null, right: Stats | null): boolean {
  return (
    left?.isFile() === true &&
    right?.isFile() === true &&
    left.ino === right.ino &&
    left.dev === right.dev
  );
}

/** Recover acknowledgements if an injected or operating-system error was uncertain. */
async function inspectEffects(entry: StagedChange, io: MoveIO): Promise<void> {
  const [backup, stage, destination] = await Promise.all([
    io.inspect(entry.backup),
    io.inspect(entry.stage),
    io.inspect(entry.destination),
  ]);
  if (backup?.isFile() === true) entry.backedUp = true;
  if (stage?.isFile() === true) entry.staged = true;
  if (sameFile(stage, destination)) entry.committed = true;
}

async function removeReplacement(
  entry: StagedChange,
  io: MoveIO
): Promise<void> {
  if (!entry.committed) return;
  const [stage, destination] = await Promise.all([
    io.inspect(entry.stage),
    io.inspect(entry.destination),
  ]);
  if (destination !== null) {
    if (
      !sameFile(stage, destination) ||
      (await io.read(entry.destination)) !== entry.change.after
    )
      throw new Error(
        `A destination changed during the move; preserved it and its backup: ${entry.destination}`
      );
    await io.unlink(entry.destination);
  }
  entry.committed = false;
}

async function restoreOriginal(entry: StagedChange, io: MoveIO): Promise<void> {
  if (!entry.backedUp) return;
  const original = await io.inspect(entry.source);
  if (original === null) await io.link(entry.backup, entry.source);
  if (hashSource(await io.read(entry.source)) !== entry.change.sourceHash)
    throw new Error(
      `Original source could not be restored without overwriting current content: ${entry.source}`
    );
  entry.backedUp = false;
}

export async function rollbackMove(
  transaction: MoveTransaction
): Promise<readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  await inOrder(transaction.entries.toReversed(), async (entry) => {
    try {
      await inspectEffects(entry, transaction.io);
      await removeReplacement(entry, transaction.io);
      await restoreOriginal(entry, transaction.io);
    } catch (error) {
      diagnostics.push(
        operationProblem('move.rollback', entry.change.path, error)
      );
    }
  });
  return diagnostics;
}
