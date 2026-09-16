import { basename, dirname } from 'node:path';

import { authoredPath, checkAncestors } from './file-paths.ts';
import type { MoveIO } from './io.ts';
import type { MoveFileOutcome } from './result-types.ts';
import type { MovePlan } from './types.ts';

async function pathState(
  plan: MovePlan,
  path: string,
  io: MoveIO
): Promise<MoveFileOutcome['state']> {
  try {
    await checkAncestors(plan.root, path, io);
    const absolute = authoredPath(plan.root, path);
    const info = await io.inspect(absolute);
    if (info === null) return 'missing';
    const names = await io.names(dirname(absolute));
    if (!names.includes(basename(path))) return 'missing';
    if (!info.isFile()) return 'changed';
    const source = await io.read(absolute);
    const planned = plan.changes.find((change) => change.destination === path);
    if (planned?.after === source) return 'planned';
    const original = plan.changes.find((change) => change.path === path);
    return original?.before === source ? 'original' : 'changed';
  } catch {
    return 'unreadable';
  }
}

export async function moveOutcomes(
  plan: MovePlan,
  io: MoveIO
): Promise<readonly MoveFileOutcome[]> {
  const paths = new Set(
    plan.changes.flatMap((change) => [change.path, change.destination])
  );
  return Promise.all(
    [...paths]
      .toSorted()
      .map(async (path) => ({ path, state: await pathState(plan, path, io) }))
  );
}
