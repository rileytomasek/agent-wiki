import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';
import type { Options } from 'micromark-extension-frontmatter';
import { gfm } from 'micromark-extension-gfm';

import { markdownFootnotes } from './markdown-footnotes.ts';
import { markdownReferences } from './markdown-references.ts';
import { markdownSections, titleDiagnostics } from './markdown-sections.ts';
import { markdownEntries } from './markdown-tree.ts';
import type {
  Diagnostic,
  Footnote,
  ParseInput,
  Reference,
  Section,
  SourceSpan,
} from './types.ts';

interface MarkdownResult {
  readonly title: string;
  readonly sections: readonly Section[];
  readonly footnotes: readonly Footnote[];
  readonly references: readonly Reference[];
  readonly diagnostics: readonly Diagnostic[];
  readonly referencesComplete: boolean;
}

export function parseMarkdown(
  input: ParseInput,
  body: SourceSpan
): MarkdownResult {
  const prefix = input.source.slice(0, body.start).trimEnd();
  const matter: Options = prefix.endsWith('...')
    ? [{ type: 'yaml', fence: { open: '---', close: '...' } }]
    : 'yaml';
  const root = fromMarkdown(input.source, {
    extensions: [gfm(), frontmatter(matter)],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(matter)],
  });
  const entries = markdownEntries(root);
  const sections = markdownSections(input, entries);
  const notes = markdownFootnotes(input, entries);
  const references = markdownReferences(
    input,
    entries,
    sections,
    notes.footnotes
  );
  const title =
    sections.find(
      (section) => section.depth === 1 && section.text.trim().length > 0
    )?.text ??
    input.path.split('/').at(-1) ??
    input.path;
  return {
    title,
    sections,
    footnotes: notes.footnotes,
    references: references.references,
    diagnostics: [
      ...titleDiagnostics(input, sections),
      ...notes.diagnostics,
      ...references.diagnostics,
    ],
    referencesComplete: references.referencesComplete,
  };
}
