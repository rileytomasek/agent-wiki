import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

import { OperationError } from '../operations/errors.ts';
import { hashSource } from '../workspace/snapshots.ts';
import { authoredPath, createParents } from './file-paths.ts';
import { inOrder } from './io.ts';
import { regularSource, verifyMovePlan } from './preflight.ts';
import type { MoveTransaction, StagedChange } from './transaction-types.ts';
import type { MoveFileChange } from './types.ts';

function entryFor(root: string, change: MoveFileChange): StagedChange {
  const token = randomUUID();
  const source = authoredPath(root, change.path);
  const destination = authoredPath(root, change.destination);
  return {
    change,
    source,
    destination,
    stage: join(
      dirname(destination),
      `.${basename(destination)}.wiki-move-${token}.stage`
    ),
    backup: join(
      dirname(source),
      `.${basename(source)}.wiki-move-${token}.backup`
    ),
    staged: false,
    backedUp: false,
    committed: false,
  };
}

export async function stageMove(transaction: MoveTransaction): Promise<void> {
  const { plan, io } = transaction;
  await inOrder(plan.changes, async (change) => {
    await createParents(
      plan.root,
      change.destination,
      io,
      transaction.directories
    );
    const info = await regularSource(plan, change.path, io);
    const entry = entryFor(plan.root, change);
    transaction.entries.push(entry);
    await io.write(entry.stage, change.after, info.mode & 0o777);
    entry.staged = true;
  });
  await verifyMovePlan(plan, io);
}

export async function commitMove(transaction: MoveTransaction): Promise<void> {
  const { io } = transaction;
  await inOrder(transaction.entries, async (entry) => {
    const current = await io.read(entry.source);
    if (hashSource(current) !== entry.change.sourceHash)
      throw new OperationError(
        'move-plan-stale',
        `Source changed before replacement: ${entry.change.path}`
      );
    await io.rename(entry.source, entry.backup);
    entry.backedUp = true;
    if (hashSource(await io.read(entry.backup)) !== entry.change.sourceHash)
      throw new OperationError(
        'move-plan-stale',
        `Source changed while being backed up: ${entry.change.path}`
      );
  });
  await inOrder(transaction.entries, async (entry) => {
    // Hard-link creation fails if another writer occupies the destination.
    await io.link(entry.stage, entry.destination);
    entry.committed = true;
  });
}
