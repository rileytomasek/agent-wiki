import { parseDocument } from '../documents/parse.ts';
import {
  normalizeDocumentPath,
  normalizeReferencePath,
} from '../documents/paths.ts';
import type { DocumentSnapshot, Reference } from '../documents/types.ts';
import { OperationError } from '../operations/errors.ts';
import { isExternalReference } from '../references/external.ts';
import type { MovePaths } from './destinations.ts';
import type { MoveFileChange } from './types.ts';

/** Reparse planned bytes and compare reference semantics before any writes. */
export function verifyPlannedChange(
  snapshot: DocumentSnapshot,
  change: MoveFileChange,
  move: MovePaths
): void {
  const parsed = parseDocument({
    path: change.destination,
    source: change.after,
    sourceHash: snapshot.document.sourceHash,
  });
  const expected = snapshot.document.references.map((reference) =>
    referenceIdentity(reference, snapshot.document.path, move)
  );
  const actual = parsed.references.map((reference) =>
    referenceIdentity(reference, change.destination)
  );
  if (
    !parsed.referencesComplete ||
    JSON.stringify(expected) !== JSON.stringify(actual)
  )
    throw new OperationError(
      'move-reference-style',
      `The move cannot preserve every reference in its authored scalar or Markdown style: ${change.path}`
    );
}

function referenceIdentity(
  reference: Reference,
  source: string,
  move?: MovePaths
): string {
  return JSON.stringify({
    target: destinationIdentity(reference, source, move),
    origin: reference.origin,
    syntax: reference.syntax,
    field: reference.field,
    citation: reference.citation,
    definition: reference.definition,
    section: reference.section,
    uses: reference.uses.length,
  });
}

function destinationIdentity(
  reference: Reference,
  source: string,
  move: MovePaths | undefined
): string {
  const { destination } = reference;
  const named = reference.origin === 'frontmatter' && reference.field !== 'url';
  if (!named && isExternalReference(destination)) return destination;
  const local = named
    ? { path: normalizeDocumentPath(source, destination), fragment: undefined }
    : normalizeReferencePath(source, destination);
  if (local?.path === undefined) return destination;
  const path = local.path === move?.from ? move.to : local.path;
  return JSON.stringify([path, local.fragment]);
}
