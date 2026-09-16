import { resultLimit } from '../operations/results.ts';
import type { DocumentFilters, ListOptions } from '../operations/types.ts';
import type { Arguments } from './arguments.ts';

const filterNames = ['type', 'category', 'name', 'about', 'path'] as const;

export function listOptions(args: Arguments): ListOptions {
  const filters: DocumentFilters = Object.fromEntries(
    filterNames.flatMap((name) => {
      const value = args[name];
      if (value === undefined) return [];
      if (value.trim() === '') throw new Error(`--${name} cannot be empty`);
      return [[name, value]];
    })
  );
  const limit = args.limit === undefined ? undefined : parseLimit(args.limit);
  return {
    filters: { ...filters, stale: args.stale },
    ...(limit === undefined ? {} : { limit }),
  };
}

function parseLimit(value: string): number {
  if (!/^\d+$/u.test(value))
    throw new Error('--limit must be a positive safe integer');
  return resultLimit(Number(value));
}

export function requireOperands(args: Arguments, count: number): void {
  if (args.operands.length !== count) {
    throw new Error(
      `${args.command} expects ${count} argument${count === 1 ? '' : 's'}`
    );
  }
}

export function rejectFilters(args: Arguments): void {
  const filter = filterNames.find((name) => args[name] !== undefined);
  if (filter !== undefined)
    throw new Error(`--${filter} is not supported by ${args.command}`);
  if (args.stale)
    throw new Error(`--stale is not supported by ${args.command}`);
  if (args.limit !== undefined)
    throw new Error(`--limit is not supported by ${args.command}`);
}
