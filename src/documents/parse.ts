import { parseFrontmatter } from './frontmatter.ts';
import { parseMarkdown } from './markdown.ts';
import type { ParseInput, ParsedDocument } from './types.ts';

/** Bump when normalized Markdown, frontmatter or source-span semantics change. */
export const PARSER_VERSION = '1';

export function parseDocument(input: ParseInput): ParsedDocument {
  const frontmatter = parseFrontmatter(input);
  const markdown = parseMarkdown(input, frontmatter.body);
  return {
    path: input.path,
    sourceHash: input.sourceHash,
    title: markdown.title,
    metadata: frontmatter.metadata,
    body: frontmatter.body,
    sections: markdown.sections,
    footnotes: markdown.footnotes,
    references: [...frontmatter.references, ...markdown.references],
    diagnostics: [...frontmatter.diagnostics, ...markdown.diagnostics],
    referencesComplete:
      frontmatter.referencesComplete && markdown.referencesComplete,
  };
}
