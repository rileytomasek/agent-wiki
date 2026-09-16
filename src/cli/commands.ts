import type { Clock } from '../documents/dates.ts';
import { listDocuments } from '../operations/list.ts';
import { showDocument } from '../operations/show.ts';
import { resolveRoot } from '../workspace/root.ts';
import type { Arguments } from './arguments.ts';
import {
  listOptions,
  rejectFilters,
  requireOperands,
} from './command-options.ts';
import { executeGraphCommand } from './graph-commands.ts';
import { executeIndexCommand } from './index-commands.ts';
import { renderList, renderShow } from './output.ts';
import type { CliResult } from './output.ts';

export interface CliContext {
  readonly cwd?: string;
  readonly clock?: Clock;
}

export async function executeCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  if (args.rebuild && args.command !== 'index')
    throw new Error(`--rebuild is not supported by ${args.command}`);
  if (args.command === 'index' || args.command === 'status')
    return executeIndexCommand(args, context);
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

async function executeInspectionCommand(
  args: Arguments,
  root: string,
  context: CliContext
): Promise<CliResult> {
  requireOperands(args, args.command === 'show' ? 1 : 0);
  if (args.command === 'show') rejectFilters(args);
  const clock = context.clock === undefined ? {} : { clock: context.clock };
  if (args.command === 'list') {
    const result = await listDocuments(root, {
      ...listOptions(args),
      ...clock,
    });
    return renderList(result, args.json);
  }
  const target = args.operands[0];
  if (target === undefined) throw new Error('show requires a target');
  return renderShow(await showDocument(root, target, clock), args.json);
}
