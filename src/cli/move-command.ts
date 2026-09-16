import { formatMoveDiff } from '../moves/diff.ts';
import { moveDocument } from '../operations/move.ts';
import { resolveRoot } from '../workspace/root.ts';
import type { Arguments } from './arguments.ts';
import { rejectFilters, requireOperands } from './command-options.ts';
import type { CliContext } from './commands.ts';
import { rendered } from './output.ts';
import type { CliResult } from './output.ts';

export async function executeMoveCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  rejectFilters(args);
  requireOperands(args, 2);
  const [from, to] = args.operands;
  if (from === undefined || to === undefined)
    throw new Error('move requires source and destination');
  const root = await resolveRoot({
    cwd: context.cwd ?? process.cwd(),
    ...(args.root === undefined ? {} : { root: args.root }),
  });
  const result = await moveDocument(root, from, to, { dryRun: args.dryRun });
  const summary = `${result.status}: ${result.plan.from} -> ${result.plan.to}; ${result.plan.changes.length} files.\n`;
  const recovery =
    result.recoveryPaths.length === 0
      ? ''
      : `Recovery files:\n${result.recoveryPaths.join('\n')}\n`;
  const files = result.files
    .map((file) => `${file.path}: ${file.state}`)
    .join('\n');
  const text = args.json
    ? JSON.stringify(result)
    : summary +
      'Planned changes:\n' +
      formatMoveDiff(result.plan) +
      `\nCurrent paths:\n${files}\n` +
      recovery;
  return rendered(result, text, args.json);
}
