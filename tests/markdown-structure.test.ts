import { expect, test } from 'vitest';

import { parseMarkdownFixture, sourceSlice } from './fixtures/markdown.ts';

test('plain Markdown retains title, body, identity and optional metadata', () => {
  const source = '# A simple *document*\n\nReadable content.\n';
  const document = parseMarkdownFixture(source);
  expect(document).toMatchObject({
    path: 'notes/example.md',
    sourceHash: 'fixture-hash',
    title: 'A simple document',
    metadata: {},
    diagnostics: [],
    referencesComplete: true,
  });
  expect(sourceSlice(source, document.body)).toBe(source);
});

test.each([
  ['No heading\n', 'example.md', 0],
  ['## Fallback\n', 'example.md', 0],
  ['# First\n\n# Second\n', 'First', 2],
  ['```md\n# Code\n```\n', 'example.md', 0],
  ['<h1>HTML</h1>\n', 'example.md', 0],
])('title errors preserve readable content: %s', (source, title, count) => {
  const document = parseMarkdownFixture(source);
  expect(document.title).toBe(title);
  expect(document.diagnostics).toEqual([
    expect.objectContaining({
      code: 'markdown-title-count',
      message: `Expected exactly one H1 title; found ${count}.`,
      severity: 'error',
    }),
  ]);
  expect(sourceSlice(source, document.body)).toBe(source);
  expect(document.referencesComplete).toBe(true);
});

test('an empty real H1 retains its heading while the display title falls back to its filename', () => {
  const document = parseMarkdownFixture('#\n\nReadable text.\n');
  expect(document.title).toBe('example.md');
  expect(document.sections[0]?.text).toBe('');
  expect(document.diagnostics).toEqual([]);
});

test('setext, formatting, duplicate anchors and nested section extents use one AST', () => {
  const source =
    'A title\n=======\n\n## Same *heading*\n\n### Child\n\nText.\n\n## Same heading\n\nEnd.\n';
  const document = parseMarkdownFixture(source);
  expect(document.diagnostics).toEqual([]);
  expect(
    document.sections.map((section) => [section.anchor, section.parent])
  ).toEqual([
    ['a-title', undefined],
    ['same-heading', 'a-title'],
    ['child', 'same-heading'],
    ['same-heading-1', 'a-title'],
  ]);
  expect(sourceSlice(source, document.sections[1]?.content)).toBe(
    '## Same *heading*\n\n### Child\n\nText.\n\n'
  );
  expect(sourceSlice(source, document.sections[2]?.heading)).toBe('### Child');
});

test.each(['---', '...'])(
  'frontmatter closer %s retains GFM footnotes and original locations',
  (closer) => {
    const source = `---\r\naliases: [Other]\r\n${closer}\r\n# Unicode café 😀\r\n\r\nClaim[^n].\r\n\r\n[^n]: [Evidence](proof.md)\r\n`;
    const document = parseMarkdownFixture(source);
    expect(document.diagnostics).toEqual([]);
    expect(document.title).toBe('Unicode café 😀');
    expect(document.body.line).toBe(4);
    expect(document.sections[0]?.heading).toMatchObject({ line: 4, column: 1 });
    expect(document.footnotes[0]?.definition).toMatchObject({
      line: 8,
      column: 1,
    });
    expect(document.references[0]).toMatchObject({
      origin: 'citation',
      citation: 'n',
      destination: 'proof.md',
    });
    expect(sourceSlice(source, document.body)).toBe(
      source.slice(source.indexOf('# Unicode'))
    );
  }
);

test('GFM tables, tasks, strikeout, autolinks and footnotes expose ordinary references', () => {
  const source = [
    '# GFM',
    '',
    '| Item | Source |',
    '| --- | --- |',
    '| ~~gone~~ | [table](table.md) |',
    '',
    '- [x] [task](task.md)',
    '',
    'https://example.com/a and <me@example.com>.',
    '',
    'Claim[^n].',
    '',
    '[^n]: Qualified [citation](proof.md).',
  ].join('\n');
  const document = parseMarkdownFixture(source);
  expect(document.diagnostics).toEqual([]);
  expect(document.references.map((reference) => reference.destination)).toEqual(
    [
      'table.md',
      'task.md',
      'https://example.com/a',
      'mailto:me@example.com',
      'proof.md',
    ]
  );
  expect(document.references.at(-1)?.origin).toBe('citation');
});

test('code, HTML attributes and unsupported wiki syntax do not create references', () => {
  const source = [
    '# Text',
    '',
    '```md',
    '[hidden](code.md) [^code]',
    '```',
    '',
    '`[inline](inline.md) [^inline]`',
    '',
    '<a href="html.md" title="[^html]">HTML</a>',
    '',
    '[[wiki.md]] ![[image.png]] [ordinary][undefined]',
    '',
    '\\[^escaped] and \\[escaped](ignored.md)',
  ].join('\n');
  const document = parseMarkdownFixture(source);
  expect(document.references).toEqual([]);
  expect(document.footnotes).toEqual([]);
  expect(document.diagnostics).toEqual([]);
});
