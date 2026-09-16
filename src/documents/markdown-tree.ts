import type { FootnoteDefinition, Nodes, Root } from 'mdast';

import { sourceSpan } from './spans.ts';
import type { SourceSpan } from './types.ts';

export interface MarkdownEntry {
  readonly node: Nodes;
  readonly quoteDepth: number;
  readonly citation?: string;
  readonly citationDefinition?: FootnoteDefinition;
}

/** Temporary AST traversal data never enters the persisted document model. */
export function markdownEntries(root: Root): readonly MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  append(root, entries);
  return entries;
}

function append(
  node: Nodes,
  entries: MarkdownEntry[],
  citation?: FootnoteDefinition,
  quoteDepth = 0
): void {
  const current = node.type === 'footnoteDefinition' ? node : citation;
  const depth = quoteDepth + Number(node.type === 'blockquote');
  entries.push({
    node,
    quoteDepth: depth,
    ...(current === undefined
      ? {}
      : { citation: current.identifier, citationDefinition: current }),
  });
  if ('children' in node) {
    for (const child of node.children) append(child, entries, current, depth);
  }
}

export function nodeSpan(source: string, node: Nodes): SourceSpan {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error('The Markdown parser did not preserve source offsets.');
  }
  // Micromark consumes an initial BOM before assigning its string offsets.
  const bom = Number(source.startsWith('\uFEFF'));
  return sourceSpan(source, start + bom, end + bom);
}

export function isEscaped(source: string, offset: number): boolean {
  let slashes = 0;
  for (let index = offset - 1; source[index] === '\\'; index--) slashes++;
  return slashes % 2 === 1;
}
