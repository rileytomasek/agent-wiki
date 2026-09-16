import { version } from '../version.ts';
import { jsonMode, parseArguments } from './arguments.ts';
import { executeCommand } from './commands.ts';
import type { CliContext } from './commands.ts';
import { help } from './help.ts';
import { failure, information } from './output.ts';
import type { CliResult } from './output.ts';

/** The executable alone writes stdout/stderr and sets process exit status. */
export async function runCli(
  args: readonly string[],
  context: CliContext = {}
): Promise<CliResult> {
  const json = jsonMode(args);
  try {
    const parsed = parseArguments(args);
    if (parsed.version) return information(version, json, 'version');
    const text = help(parsed.command);
    if (parsed.help || parsed.command === undefined) {
      return information(text, json, 'help');
    }
    return await executeCommand(parsed, context);
  } catch (error) {
    return failure(error, json);
  }
}
