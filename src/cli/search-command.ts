import { searchWiki } from '../search/search.ts';
import { resolveRoot } from '../workspace/root.ts';
import type { Arguments } from './arguments.ts';
import { listOptions, requireOperands } from './command-options.ts';
import type { CliContext } from './commands.ts';
import type { CliResult } from './output.ts';
import { renderSearch } from './search-output.ts';

export async function executeSearchCommand(
  args: Arguments,
  context: CliContext
): Promise<CliResult> {
  requireOperands(args, 1);
  if (args.path !== undefined)
    throw new Error('--path is supported by list, not search');
  const query = args.operands[0];
  if (query === undefined) throw new Error('search requires a query');
  const options = listOptions(args);
  const root = await resolveRoot({
    cwd: context.cwd ?? process.cwd(),
    ...(args.root === undefined ? {} : { root: args.root }),
  });
  const result = await searchWiki(root, query, {
    ...options,
    ...(context.clock === undefined ? {} : { clock: context.clock }),
    ...(context.search === undefined ? {} : { search: context.search }),
  });
  return renderSearch(result, args.json);
}
