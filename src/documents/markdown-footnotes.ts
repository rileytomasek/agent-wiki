import { isEscaped, nodeSpan } from './markdown-tree.ts';
import type { MarkdownEntry } from './markdown-tree.ts';
import { sourceSpan } from './spans.ts';
import type { Diagnostic, Footnote, ParseInput, SourceSpan } from './types.ts';

interface MutableFootnote {
  readonly identifier: string;
  definition?: SourceSpan;
  readonly uses: SourceSpan[];
}

export interface MarkdownFootnotes {
  readonly footnotes: readonly Footnote[];
  readonly diagnostics: readonly Diagnostic[];
}

export function markdownFootnotes(
  input: ParseInput,
  entries: readonly MarkdownEntry[]
): MarkdownFootnotes {
  const notes = new Map<string, MutableFootnote>();
  for (const { node } of entries) {
    if (node.type === 'footnoteDefinition') {
      const note = getNote(notes, node.identifier);
      note.definition ??= nodeSpan(input.source, node);
    }
    if (node.type === 'footnoteReference') {
      getNote(notes, node.identifier).uses.push(nodeSpan(input.source, node));
    }
  }
  const diagnostics = entries.flatMap((entry) =>
    missingNotes(input, entry, notes)
  );
  return { footnotes: [...notes.values()], diagnostics };
}

function getNote(
  notes: Map<string, MutableFootnote>,
  identifier: string
): MutableFootnote {
  const existing = notes.get(identifier);
  if (existing !== undefined) return existing;
  const note = { identifier, uses: [] };
  notes.set(identifier, note);
  return note;
}

function missingNotes(
  input: ParseInput,
  entry: MarkdownEntry,
  notes: Map<string, MutableFootnote>
): readonly Diagnostic[] {
  if (entry.node.type !== 'text') return [];
  const node = nodeSpan(input.source, entry.node);
  const text = input.source.slice(node.start, node.end);
  const diagnostics: Diagnostic[] = [];
  for (const match of text.matchAll(
    /\[\^((?:\\[[\]\\]|[^[\]\s]){1,1000})\]/gu
  )) {
    if (isEscaped(text, match.index)) continue;
    const identifier = normalizeIdentifier(match[1] ?? '');
    if (notes.get(identifier)?.definition !== undefined) continue;
    const start = node.start + match.index;
    const span = sourceSpan(input.source, start, start + match[0].length);
    getNote(notes, identifier).uses.push(span);
    diagnostics.push({
      code: 'markdown-footnote-missing',
      severity: 'error',
      path: input.path,
      span,
      message: `Footnote "${identifier}" has no definition.`,
    });
  }
  return diagnostics;
}

function normalizeIdentifier(identifier: string): string {
  return identifier
    .replaceAll(/[\t\n\r ]+/gu, ' ')
    .trim()
    .toUpperCase()
    .toLowerCase();
}
