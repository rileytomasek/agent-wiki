import { listDocuments } from '../operations/list.ts';
import { showDocument } from '../operations/show.ts';
import type { Arguments } from './arguments.ts';
import {
  listOptions,
  rejectFilters,
  requireOperands,
} from './command-options.ts';
import type { CliContext } from './commands.ts';
import { renderList, renderShow } from './output.ts';
import type { CliResult } from './output.ts';

export async function executeInspectionCommand(
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
