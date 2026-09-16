import { parseDocument } from '../../src/documents/parse.ts';
import type { ParsedDocument, SourceSpan } from '../../src/documents/types.ts';

export function parseMarkdownFixture(source: string): ParsedDocument {
  return parseDocument({
    path: 'notes/example.md',
    source,
    sourceHash: 'fixture-hash',
  });
}

export function sourceSlice(
  source: string,
  span: SourceSpan | undefined
): string {
  if (span === undefined) throw new Error('Expected a source span.');
  return source.slice(span.start, span.end);
}
