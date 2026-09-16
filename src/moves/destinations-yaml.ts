import type { DestinationSyntax } from '../documents/types.ts';
import { OperationError } from '../operations/errors.ts';

/** Preserve the authored scalar style without reserializing its containing YAML. */
export function yamlDestination(
  before: string,
  destination: string,
  syntax: DestinationSyntax
): string {
  const literal = /^[a-z][a-z\d+.-]*:/iu.test(destination)
    ? `./${destination}`
    : destination;
  if (syntax === 'yaml-single') return `'${literal.replaceAll("'", "''")}'`;
  if (syntax === 'yaml-double') return JSON.stringify(literal);
  if (syntax === 'yaml-block') return blockDestination(before, literal);
  return plainDestination(literal);
}

function plainDestination(destination: string): string {
  // A relative prefix also prevents a filename from being interpreted as a URI.
  const reserved = /^[!&*#%{}[\],? |>'"@`-]/u.test(destination);
  return reserved ? `./${destination}` : destination;
}

function blockDestination(before: string, destination: string): string {
  const header = /^[>|][^\r\n]*(?:\r\n|\n|\r)[ \t]*/u.exec(before)?.[0];
  if (header === undefined)
    throw new OperationError(
      'move-reference-style',
      'Could not preserve a YAML block scalar destination.'
    );
  const trailing = /(?:\r\n|\n|\r)[\t \r\n]*$/u.exec(before)?.[0] ?? '';
  return `${header}${destination}${trailing}`;
}
