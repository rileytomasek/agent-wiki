import type { Definition, Image, Link } from 'mdast';

import { markdownDestination } from './markdown-destinations.ts';
import { sectionAt } from './markdown-sections.ts';
import { nodeSpan } from './markdown-tree.ts';
import type { MarkdownEntry } from './markdown-tree.ts';
import type {
  Diagnostic,
  Footnote,
  ParseInput,
  Reference,
  Section,
  SourceSpan,
} from './types.ts';

interface Context {
  readonly input: ParseInput;
  readonly definitions: ReadonlyMap<string, Target>;
  readonly footnotes: readonly Footnote[];
  readonly sections: readonly Section[];
}

interface Target {
  readonly node: Link | Image | Definition;
  readonly quoteDepth: number;
  readonly definition?: string;
}

export interface MarkdownReferences {
  readonly references: readonly Reference[];
  readonly diagnostics: readonly Diagnostic[];
  readonly referencesComplete: boolean;
}

export function markdownReferences(
  input: ParseInput,
  entries: readonly MarkdownEntry[],
  sections: readonly Section[],
  footnotes: readonly Footnote[]
): MarkdownReferences {
  const definitions = definitionMap(entries);
  const context = { input, definitions, sections, footnotes };
  const references = entries.flatMap((entry) =>
    extractReference(context, entry)
  );
  const diagnostics = references.flatMap((item) => spanDiagnostic(input, item));
  return {
    references: combine(references, sections),
    diagnostics,
    referencesComplete: diagnostics.length === 0,
  };
}

function definitionMap(
  entries: readonly MarkdownEntry[]
): ReadonlyMap<string, Target> {
  const definitions = new Map<string, Target>();
  for (const { node, quoteDepth } of entries) {
    if (node.type === 'definition' && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, {
        node,
        quoteDepth,
        definition: node.identifier,
      });
    }
  }
  return definitions;
}

function target(context: Context, entry: MarkdownEntry): Target | undefined {
  const { node, quoteDepth } = entry;
  if (node.type === 'link' || node.type === 'image')
    return { node, quoteDepth };
  if (node.type === 'definition')
    return { node, quoteDepth, definition: node.identifier };
  if (node.type !== 'linkReference' && node.type !== 'imageReference')
    return undefined;
  return context.definitions.get(node.identifier);
}

function extractReference(
  context: Context,
  entry: MarkdownEntry
): readonly Reference[] {
  const destination = target(context, entry);
  if (destination === undefined) return [];
  const span = nodeSpan(context.input.source, entry.node);
  const uses =
    entry.node.type === 'definition' ? [] : citationUses(context, entry, span);
  const origin = referenceOrigin(entry);
  return [
    {
      destination: destination.node.url,
      uses,
      origin,
      syntax: 'markdown',
      ...markdownDestination(
        context.input.source,
        destination.node,
        destination.quoteDepth
      ),
      ...(entry.citation === undefined ? {} : { citation: entry.citation }),
      ...(destination.definition === undefined
        ? {}
        : { definition: destination.definition }),
    },
  ];
}

function referenceOrigin(entry: MarkdownEntry): Reference['origin'] {
  if (entry.citation !== undefined) return 'citation';
  return entry.node.type === 'image' || entry.node.type === 'imageReference'
    ? 'image'
    : 'link';
}

function citationUses(
  context: Context,
  entry: MarkdownEntry,
  fallback: SourceSpan
): readonly SourceSpan[] {
  const note = context.footnotes.find(
    (item) => item.identifier === entry.citation
  );
  const definition = entry.citationDefinition;
  if (note === undefined || definition === undefined) return [fallback];
  const actual = nodeSpan(context.input.source, definition);
  if (note.definition?.start !== actual.start || note.uses.length === 0)
    return [fallback];
  return note.uses;
}

function commonSection(
  sections: readonly Section[],
  uses: readonly SourceSpan[]
): string | undefined {
  const owners = new Set(uses.map((span) => sectionAt(sections, span)));
  return owners.size === 1 ? owners.values().next().value : undefined;
}

function spanDiagnostic(
  input: ParseInput,
  reference: Reference
): readonly Diagnostic[] {
  if (reference.destinationSpan !== undefined) return [];
  const span = reference.uses[0];
  return [
    {
      code: 'markdown-destination-span',
      severity: 'error',
      path: input.path,
      message: 'Could not locate the exact authored reference destination.',
      ...(span === undefined ? {} : { span }),
    },
  ];
}

function combine(
  references: readonly Reference[],
  sections: readonly Section[]
): readonly Reference[] {
  const groups = new Map<string, Reference>();
  for (const reference of references) {
    const key = referenceKey(reference);
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, reference);
    else
      groups.set(key, {
        ...existing,
        uses: [...existing.uses, ...reference.uses],
      });
  }
  const combined: Reference[] = [];
  for (const reference of groups.values()) {
    const uses = [
      ...new Map(reference.uses.map((span) => [span.start, span])).values(),
    ];
    const section = commonSection(sections, uses);
    combined.push({
      ...reference,
      uses,
      ...(section === undefined ? {} : { section }),
    });
  }
  return combined;
}

function referenceKey(reference: Reference): string {
  const location =
    reference.destinationSpan?.start ??
    reference.uses[0]?.start ??
    `${reference.definition}:${reference.destination}`;
  return `${location}:${reference.destinationSpan?.end}:${reference.origin}:${reference.citation ?? ''}`;
}
