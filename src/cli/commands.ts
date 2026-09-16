import type { Clock } from '../documents/dates.ts';
import type { WikiSearchOptions } from '../search/query-types.ts';
import { resolveRoot } from '../workspace/root.ts';
import type { Arguments } from './arguments.ts';
import { executeGraphCommand } from './graph-commands.ts';
import { executeIndexCommand } from './index-commands.ts';
import { executeInspectionCommand } from './inspection-commands.ts';
import { executeMoveCommand } from './move-command.ts';
import type { CliResult } from './output.ts';
import { executeSearchCommand } from './search-command.ts';

export interface CliContext {
  readonly cwd?: string;
  readonly clock?: Clock;
  readonly search?: WikiSearchOptions['search'];
}

export async function executeCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  if (args.rebuild && args.command !== 'index')
    throw new Error(`--rebuild is not supported by ${args.command}`);
  if (args.dryRun && args.command !== 'move')
    throw new Error(`--dry-run is not supported by ${args.command}`);
  if (args.command === 'move') return executeMoveCommand(args, context);
  if (args.command === 'index' || args.command === 'status')
    return executeIndexCommand(args, context);
  if (args.command === 'search') return executeSearchCommand(args, context);
  return executeReadCommand(args, context);
}

async function executeReadCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  if (!['show', 'list', 'related', 'validate'].includes(args.command ?? '')) {
    throw new Error(`Command '${args.command}' is not implemented yet`);
  }
  const root = await resolveRoot({
    cwd: context.cwd ?? process.cwd(),
    ...(args.root === undefined ? {} : { root: args.root }),
  });
  if (args.command === 'related' || args.command === 'validate')
    return executeGraphCommand(args, root);
  return executeInspectionCommand(args, root, context);
}
