import type {
  Diagnostic,
  ParsedDocument,
  Reference,
  SourceSpan,
} from '../documents/types.ts';
import { resolveReference } from './resolve.ts';
import type { ResolutionContext } from './resolve.ts';
import type { ReferenceOccurrence } from './types.ts';

export function referenceOccurrences(
  context: ResolutionContext
): readonly ReferenceOccurrence[] {
  const documents = context.input.documents.toSorted((left, right) =>
    comparePaths(left.document.path, right.document.path)
  );
  return documents.flatMap(({ document }) =>
    document.references.flatMap((reference, index) =>
      occurrencesFor(context, document, reference, index)
    )
  );
}

function comparePaths(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function occurrencesFor(
  context: ResolutionContext,
  document: ParsedDocument,
  reference: Reference,
  index: number
): readonly ReferenceOccurrence[] {
  const resolution = resolveReference(context, document.path, reference);
  const uses = reference.uses.length === 0 ? [undefined] : reference.uses;
  const result: ReferenceOccurrence[] = [];
  for (const [useIndex, use] of uses.entries()) {
    const sourceSection = useSection(document, use);
    result.push({
      id: `${encodeURIComponent(document.path)}:${index}:${useIndex}`,
      sourcePath: document.path,
      reference,
      resolution,
      active: reference.uses.length > 0,
      ...(sourceSection === undefined ? {} : { sourceSection }),
      ...(use === undefined ? {} : { use }),
    });
  }
  return result;
}

function useSection(
  document: ParsedDocument,
  use: SourceSpan | undefined
): string | undefined {
  if (use === undefined) return undefined;
  return document.sections.findLast(
    (section) =>
      use.start >= section.content.start && use.end <= section.content.end
  )?.anchor;
}

export function resolutionDiagnostic(
  occurrence: ReferenceOccurrence
): readonly Diagnostic[] {
  const { resolution } = occurrence;
  if (resolution.status === 'resolved') return [];
  const span = occurrence.use ?? occurrence.reference.destinationSpan;
  return [
    {
      code: `reference-${resolution.reason}`,
      severity: 'error',
      path: occurrence.sourcePath,
      message: `Cannot resolve "${occurrence.reference.destination}": ${resolution.reason.replaceAll('-', ' ')}.`,
      ...(span === undefined ? {} : { span }),
    },
  ];
}
