import { parseArgs } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';

const options = {
  root: { type: 'string' },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false },
  type: { type: 'string' },
  category: { type: 'string' },
  name: { type: 'string' },
  about: { type: 'string' },
  path: { type: 'string' },
  stale: { type: 'boolean', default: false },
  limit: { type: 'string' },
} satisfies ParseArgsOptionsConfig;

/** Read output mode even when strict parsing will subsequently report an error. */
export function jsonMode(args: readonly string[]): boolean {
  const boundary = args.indexOf('--');
  return args
    .slice(0, boundary < 0 ? args.length : boundary)
    .includes('--json');
}

export interface Arguments {
  readonly command: string | undefined;
  readonly operands: readonly string[];
  readonly root: string | undefined;
  readonly json: boolean;
  readonly help: boolean;
  readonly version: boolean;
  readonly type: string | undefined;
  readonly category: string | undefined;
  readonly name: string | undefined;
  readonly about: string | undefined;
  readonly path: string | undefined;
  readonly stale: boolean;
  readonly limit: string | undefined;
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
  return {
    command,
    operands,
    ...values,
    root: values.root,
    type: values.type,
    category: values.category,
    name: values.name,
    about: values.about,
    path: values.path,
    limit: values.limit,
  };
}
