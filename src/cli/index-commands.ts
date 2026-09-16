import { indexWiki } from '../search/index.ts';
import { indexStatus } from '../search/status.ts';
import { resolveRoot } from '../workspace/root.ts';
import type { Arguments } from './arguments.ts';
import { rejectFilters, requireOperands } from './command-options.ts';
import type { CliContext } from './commands.ts';
import { renderIndex, renderStatus } from './index-output.ts';
import type { CliResult } from './output.ts';

export async function executeIndexCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  requireOperands(args, 0);
  rejectFilters(args);
  const root = await resolveRoot({
    cwd: context.cwd ?? process.cwd(),
    ...(args.root === undefined ? {} : { root: args.root }),
  });
  if (args.command === 'status')
    return renderStatus(await indexStatus(root), args.json);
  const result = await indexWiki(root, {
    rebuild: args.rebuild,
    ...(context.clock === undefined ? {} : { clock: context.clock }),
  });
  return renderIndex(result, args.json);
}
