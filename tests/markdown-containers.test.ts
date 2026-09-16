import { expect, test } from 'vitest';

import { parseMarkdownFixture, sourceSlice } from './fixtures/markdown.ts';

test.each([
  '> [a](\n>   a.md\n> )',
  '> > [a](\n> >   a.md\n> > )',
  '> - [a](\n>     a.md\n>   )',
  '- > [a](\n  >   a.md\n  > )',
  '> [ref]:\n>   a.md\n\n> [x][ref]',
  '> > [ref]:\n> >   a.md\n\n> > [x][ref]',
  '- > [ref]:\n  >   a.md\n\n  > [x][ref]',
])('container prefixes never become destination edits: %s', (body) => {
  const source = `# Title\n\n${body}\n`;
  const document = parseMarkdownFixture(source);
  expect(document.references).toHaveLength(1);
  expect(document.referencesComplete).toBe(true);
  expect(document.diagnostics).toEqual([]);
  expect(document.references[0]?.destination).toBe('a.md');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    'a.md'
  );
});

test('nested quoted destinations preserve CRLF, BOM, angle syntax, and escapes', () => {
  const source =
    '\uFEFF# Title\r\n\r\n> > [a](\r\n> >   <d/a b\\(c\\).md>\r\n> > )\r\n';
  const document = parseMarkdownFixture(source);
  expect(document.referencesComplete).toBe(true);
  expect(document.diagnostics).toEqual([]);
  expect(document.references[0]?.destination).toBe('d/a b(c).md');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    'd/a b\\(c\\).md'
  );
  expect(document.references[0]?.destinationSpan).toMatchObject({
    line: 4,
    column: 8,
  });
});

test('escaped destination greater-than characters survive actual container markers', () => {
  const source = '# Title\n\n> [a](\n> \\>a.md\n> )\n';
  const document = parseMarkdownFixture(source);
  expect(document.referencesComplete).toBe(true);
  expect(document.references[0]?.destination).toBe('>a.md');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    '\\>a.md'
  );
});

test('non-ASCII whitespace remains part of a literal authored filename', () => {
  const source = '# Title\n\n[a](\u00A0a\u00A0b.md)\n';
  const document = parseMarkdownFixture(source);
  expect(document.referencesComplete).toBe(true);
  expect(document.references[0]?.destination).toBe('\u00A0a\u00A0b.md');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    '\u00A0a\u00A0b.md'
  );
});

test('duplicate footnote definitions retain destinations without borrowing first-definition use sites', () => {
  const source =
    '# T\n\nClaim[^first]\n\n[^first]: [a](a.md)\n\n[^first]: [b](b.md)\n';
  const document = parseMarkdownFixture(source);
  const first = document.references.find(
    (reference) => reference.destination === 'a.md'
  );
  const duplicate = document.references.find(
    (reference) => reference.destination === 'b.md'
  );
  expect(document.referencesComplete).toBe(true);
  expect(document.footnotes).toHaveLength(1);
  expect(sourceSlice(source, document.footnotes[0]?.definition)).toBe(
    '[^first]: [a](a.md)'
  );
  expect(first?.uses.map((span) => sourceSlice(source, span))).toEqual([
    '[^first]',
  ]);
  expect(duplicate?.uses.map((span) => sourceSlice(source, span))).toEqual([
    '[b](b.md)',
  ]);
  expect(sourceSlice(source, duplicate?.destinationSpan)).toBe('b.md');
});

test('autolink spelling matches native URL semantics including literal entities and inferred schemes', () => {
  const source =
    '# Title\n\n<https://example.com/a&amp;b> www.example.com <a@b.com>\n';
  const document = parseMarkdownFixture(source);
  expect(document.referencesComplete).toBe(true);
  expect(document.diagnostics).toEqual([]);
  expect(document.references.map((reference) => reference.destination)).toEqual(
    ['https://example.com/a&amp;b', 'http://www.example.com', 'mailto:a@b.com']
  );
  expect(
    document.references.map((reference) =>
      sourceSlice(source, reference.destinationSpan)
    )
  ).toEqual(['https://example.com/a&amp;b', 'www.example.com', 'a@b.com']);
});
