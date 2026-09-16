import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';

import { nodeSpan } from './markdown-tree.ts';
import type { MarkdownEntry } from './markdown-tree.ts';
import { sourceSpan } from './spans.ts';
import type { Diagnostic, ParseInput, Section } from './types.ts';

export function markdownSections(
  input: ParseInput,
  entries: readonly MarkdownEntry[]
): readonly Section[] {
  const slugger = new GithubSlugger();
  const headings = entries.flatMap(({ node }) => {
    if (node.type !== 'heading') return [];
    const text = toString(node, { includeHtml: false });
    return [
      {
        depth: node.depth,
        text,
        anchor: slugger.slug(text),
        heading: nodeSpan(input.source, node),
      },
    ];
  });
  const sections: Section[] = [];
  for (const [index, heading] of headings.entries()) {
    const end =
      headings.slice(index + 1).find((next) => next.depth <= heading.depth)
        ?.heading.start ?? input.source.length;
    const parent = headings
      .slice(0, index)
      .findLast((previous) => previous.depth < heading.depth)?.anchor;
    sections.push({
      depth: heading.depth,
      text: heading.text,
      anchor: heading.anchor,
      heading: heading.heading,
      content: sourceSpan(input.source, heading.heading.start, end),
      ...(parent === undefined ? {} : { parent }),
    });
  }
  return sections;
}

export function titleDiagnostics(
  input: ParseInput,
  sections: readonly Section[]
): readonly Diagnostic[] {
  const titles = sections.filter((section) => section.depth === 1);
  if (titles.length === 1) return [];
  const span = titles[1]?.heading ?? sourceSpan(input.source, 0, 0);
  return [
    {
      code: 'markdown-title-count',
      severity: 'error',
      path: input.path,
      span,
      message: `Expected exactly one H1 title; found ${titles.length}.`,
    },
  ];
}

export function sectionAt(
  sections: readonly Section[],
  span: SourcePosition
): string | undefined {
  return sections.findLast(
    (section) =>
      section.heading.start <= span.start && section.content.end > span.start
  )?.anchor;
}

interface SourcePosition {
  readonly start: number;
}
