import { parseArgs } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';

const options = {
  root: { type: 'string' },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
} satisfies ParseArgsOptionsConfig;

/** Read output mode even when strict parsing will subsequently report an error. */
export function jsonMode(args: readonly string[]): boolean {
  const { values } = parseArgs({
    args: [...args],
    options,
    allowPositionals: true,
    strict: false,
  });
  return values.json === true;
}

export interface Arguments {
  readonly command: string | undefined;
  readonly operands: readonly string[];
  readonly root: string | undefined;
  readonly json: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

/** Node's parser accepts globals on either side of a command and honors --. */
export function parseArguments(args: readonly string[]): Arguments {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options,
  });
  const [command, ...operands] = positionals;
  return { command, operands, ...values, root: values.root };
}
