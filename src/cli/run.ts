import { version } from '../version.ts';
import { jsonMode, parseArguments } from './arguments.ts';
import { help } from './help.ts';

export interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function success(text: string, json: boolean, key: string): CliResult {
  const stdout = json ? JSON.stringify({ [key]: text, diagnostics: [] }) : text;
  return { stdout: `${stdout}\n`, stderr: '', exitCode: 0 };
}

/** A side-effect-free boundary; the executable alone owns process I/O. */
export function runCli(args: readonly string[]): CliResult {
  const json = jsonMode(args);
  try {
    const parsed = parseArguments(args);
    if (parsed.version) return success(version, json, 'version');
    const text = help(parsed.command);
    if (parsed.help || parsed.command === undefined) {
      return success(text, json, 'help');
    }
    throw new Error(`Command '${parsed.command}' is not implemented yet`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      const result = { diagnostics: [{ code: 'cli_error', message }] };
      return { stdout: `${JSON.stringify(result)}\n`, stderr: '', exitCode: 1 };
    }
    return { stdout: '', stderr: `wiki: ${message}\n`, exitCode: 1 };
  }
}
