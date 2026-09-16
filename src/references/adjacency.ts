import type { ParsedDocument } from '../documents/types.ts';
import { localTargetId } from './targets.ts';
import type { ReferenceOccurrence } from './types.ts';

interface Adjacency {
  readonly incoming: ReadonlyMap<string, readonly ReferenceOccurrence[]>;
  readonly outgoing: ReadonlyMap<string, readonly ReferenceOccurrence[]>;
}

export function adjacency(
  documents: ReadonlyMap<string, ParsedDocument>,
  references: readonly ReferenceOccurrence[]
): Adjacency {
  const incoming = new Map<string, ReferenceOccurrence[]>();
  const outgoing = new Map<string, ReferenceOccurrence[]>();
  for (const occurrence of references) {
    if (!occurrence.active) continue;
    add(outgoing, localTargetId(occurrence.sourcePath), occurrence);
    for (const id of sourceSections(
      documents.get(occurrence.sourcePath),
      occurrence
    ))
      add(outgoing, id, occurrence);
    addIncoming(incoming, occurrence);
  }
  return { incoming, outgoing };
}

function add(
  map: Map<string, ReferenceOccurrence[]>,
  id: string,
  occurrence: ReferenceOccurrence
): void {
  const entries = map.get(id) ?? [];
  entries.push(occurrence);
  map.set(id, entries);
}

function sourceSections(
  document: ParsedDocument | undefined,
  occurrence: ReferenceOccurrence
): readonly string[] {
  const use = occurrence.use;
  if (document === undefined || use === undefined) return [];
  return document.sections
    .filter(
      (section) =>
        use.start >= section.content.start && use.end <= section.content.end
    )
    .map((section) => localTargetId(document.path, section.anchor));
}

function addIncoming(
  map: Map<string, ReferenceOccurrence[]>,
  occurrence: ReferenceOccurrence
): void {
  if (occurrence.resolution.status !== 'resolved') return;
  const { target } = occurrence.resolution;
  add(map, target.id, occurrence);
  if (target.kind === 'section')
    add(map, localTargetId(target.path), occurrence);
}
