import type {
  DocumentSnapshot,
  Footnote,
  Section,
  SourceSpan,
} from '../documents/types.ts';

interface SectionContent {
  readonly content: string;
  readonly headingContext: readonly Section[];
  readonly footnotes: readonly Footnote[];
}

export function sectionContent(
  snapshot: DocumentSnapshot,
  section: Section
): SectionContent {
  const { source, document } = snapshot;
  const headingContext = ancestors(document.sections, section);
  const ranges = [
    ...headingContext.map((heading) => heading.heading),
    section.content,
  ];
  const footnotes = referencedFootnotes(document.footnotes, ranges);
  const appended = appendedDefinitions(footnotes, ranges);
  const parts = [...ranges, ...appended].map((span) =>
    source.slice(span.start, span.end)
  );
  return { content: joinSlices(parts, source), headingContext, footnotes };
}

function appendedDefinitions(
  footnotes: readonly Footnote[],
  ranges: readonly SourceSpan[]
): readonly SourceSpan[] {
  const candidates = footnotes
    .flatMap((note) => outsideDefinition(note, ranges))
    .toSorted(
      (left, right) => left.start - right.start || right.end - left.end
    );
  const appended: SourceSpan[] = [];
  for (const candidate of candidates) {
    if (!covered(candidate, appended)) appended.push(candidate);
  }
  return appended;
}

function ancestors(
  sections: readonly Section[],
  selected: Section
): readonly Section[] {
  const result: Section[] = [];
  const byAnchor = new Map(
    sections.map((section) => [section.anchor, section])
  );
  let parent = selected.parent;
  while (parent !== undefined && result.length < sections.length) {
    const section = byAnchor.get(parent);
    if (section === undefined) break;
    result.unshift(section);
    parent = section.parent;
  }
  return result;
}

function covered(span: SourceSpan, ranges: readonly SourceSpan[]): boolean {
  return ranges.some(
    (range) => span.start >= range.start && span.end <= range.end
  );
}

function outsideDefinition(
  note: Footnote,
  ranges: readonly SourceSpan[]
): readonly SourceSpan[] {
  const definition = note.definition;
  return definition === undefined || covered(definition, ranges)
    ? []
    : [definition];
}

function noteAppears(note: Footnote, range: SourceSpan): boolean {
  if (note.definition !== undefined && covered(note.definition, [range]))
    return true;
  return note.uses.some((use) => covered(use, [range]));
}

function referencedFootnotes(
  footnotes: readonly Footnote[],
  initial: readonly SourceSpan[]
): readonly Footnote[] {
  const ranges = [...initial];
  const found = new Map<string, Footnote>();
  for (const range of ranges) {
    for (const note of footnotes) {
      if (found.has(note.identifier) || !noteAppears(note, range)) continue;
      found.set(note.identifier, note);
      ranges.push(...outsideDefinition(note, ranges));
    }
  }
  return [...found.values()];
}

function joinSlices(parts: readonly string[], source: string): string {
  const newline = /\r\n|\r|\n/u.exec(source)?.[0] ?? '\n';
  let content = '';
  for (const part of parts) {
    if (content.length > 0 && !content.endsWith(newline)) content += newline;
    if (content.length > 0 && !content.endsWith(newline + newline))
      content += newline;
    content += part;
  }
  return content;
}
