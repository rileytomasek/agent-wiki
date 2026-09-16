import { posix } from 'node:path';

import { decodeString } from 'micromark-util-decode-string';

import {
  normalizeDocumentPath,
  normalizeReferencePath,
} from '../documents/paths.ts';
import type { Reference } from '../documents/types.ts';
import { OperationError } from '../operations/errors.ts';
import { isExternalReference } from '../references/external.ts';
import type { ReferenceOccurrence } from '../references/types.ts';
import { yamlDestination } from './destinations-yaml.ts';
import type { SourceEdit } from './edits.ts';

export interface MovePaths {
  readonly from: string;
  readonly to: string;
}

/** One physical destination may be returned repeatedly; normalizeEdits deduplicates it. */
export function referenceEdit(
  occurrence: ReferenceOccurrence,
  source: string,
  move: MovePaths
): SourceEdit | undefined {
  const { reference, sourcePath } = occurrence;
  const path = localPath(occurrence, move);
  if (path === undefined || (sourcePath !== move.from && path !== move.from))
    return undefined;
  const from = sourcePath === move.from ? move.to : sourcePath;
  const target = path === move.from ? move.to : path;
  if (keepsDestination(reference, from, target)) return undefined;
  const span = reference.destinationSpan;
  if (span === undefined)
    throw new OperationError(
      'move-reference-incomplete',
      `An affected destination cannot be edited exactly: ${sourcePath}`
    );
  const relative = posix.relative(posix.dirname(from), target) || '.';
  const before = source.slice(span.start, span.end);
  const after = renderedDestination(reference, relative, before);
  return before === after ? undefined : { span, before, after };
}

function localPath(
  occurrence: ReferenceOccurrence,
  move: MovePaths
): string | undefined {
  const { resolution, reference, sourcePath } = occurrence;
  if (resolution.status === 'resolved')
    return resolution.target.kind === 'external'
      ? undefined
      : resolution.target.path;
  if (resolution.path !== undefined) return resolution.path;
  if (sourcePath !== move.from || isExternalReference(reference.destination))
    return undefined;
  throw new OperationError(
    'move-reference-invalid',
    `Cannot safely rebase an invalid destination in ${sourcePath}: ${reference.destination}`
  );
}

function keepsDestination(
  reference: Reference,
  source: string,
  target: string
): boolean {
  const current =
    reference.origin === 'frontmatter'
      ? normalizeDocumentPath(source, reference.destination)
      : normalizeReferencePath(source, reference.destination)?.path;
  return current === target;
}

function renderedDestination(
  reference: Reference,
  relative: string,
  before: string
): string {
  if (reference.origin === 'frontmatter')
    return yamlDestination(before, relative, reference.syntax);
  return encodedPath(relative) + fragmentSuffix(before, reference.destination);
}

function encodedPath(path: string): string {
  try {
    return path
      .split('/')
      .map((part) =>
        encodeURIComponent(part).replaceAll(
          /[!'()*]/gu,
          (character) =>
            `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
        )
      )
      .join('/');
  } catch {
    throw new OperationError(
      'move-destination-invalid',
      'The destination path cannot be represented as a Markdown URI.'
    );
  }
}

function fragmentSuffix(before: string, destination: string): string {
  if (!destination.includes('#')) return '';
  const tokens = before.matchAll(
    /\\[^\r\n]|&(?:#x[\da-f]+|#\d+|[a-z][\da-z]+);|[\s\S]/giu
  );
  for (const token of tokens) {
    if (decodeString(token[0]) === '#') return before.slice(token.index);
  }
  throw new OperationError(
    'move-reference-style',
    'Could not preserve an authored Markdown fragment.'
  );
}
