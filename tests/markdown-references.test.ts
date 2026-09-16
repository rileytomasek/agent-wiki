import { array, assert, constantFrom, property } from 'fast-check';
import { expect, test } from 'vitest';

import { parseMarkdownFixture, sourceSlice } from './fixtures/markdown.ts';

test('reference definitions preserve repeated, collapsed and shortcut use sites once', () => {
  const source =
    '# Title\n\n[a][shared] [shared][] [shared]\n\n## Next\n\n[b][shared]\n\n[SHARED]: <nested/a b.md#part> "Kept title"\n[unused]: spare.md\n';
  const document = parseMarkdownFixture(source);
  expect(document.references).toHaveLength(2);
  const reference = document.references[0];
  expect(reference).toMatchObject({
    destination: 'nested/a b.md#part',
    definition: 'shared',
    syntax: 'angle',
  });
  expect(reference?.section).toBeUndefined();
  expect(reference?.uses.map((span) => sourceSlice(source, span))).toEqual([
    '[a][shared]',
    '[shared][]',
    '[shared]',
    '[b][shared]',
  ]);
  expect(sourceSlice(source, reference?.destinationSpan)).toBe(
    'nested/a b.md#part'
  );
  expect(document.references[1]).toMatchObject({
    definition: 'unused',
    uses: [],
    destination: 'spare.md',
  });
});

test('citation definitions retain explanations, multiple links, repeated uses and no-link notes', () => {
  const source =
    '# Claim\n\nA[^n] and B[^n]. Plain[^plain].\n\n## Evidence\n\n[^n]: Qualified [one](one.md), [two][shared].\n\n[^plain]: No target asserted.\n\n[shared]: https://example.com/work\n';
  const document = parseMarkdownFixture(source);
  const note = document.footnotes.find(
    (footnote) => footnote.identifier === 'n'
  );
  expect(document.diagnostics).toEqual([]);
  expect(sourceSlice(source, note?.definition)).toBe(
    '[^n]: Qualified [one](one.md), [two][shared].'
  );
  expect(note?.uses.map((span) => sourceSlice(source, span))).toEqual([
    '[^n]',
    '[^n]',
  ]);
  const citations = document.references.filter(
    (reference) => reference.origin === 'citation'
  );
  expect(citations.map((reference) => reference.destination)).toEqual([
    'one.md',
    'https://example.com/work',
  ]);
  expect(
    citations.map((reference) => [reference.citation, reference.uses.length])
  ).toEqual([
    ['n', 2],
    ['n', 2],
  ]);
  expect(
    document.footnotes.find((footnote) => footnote.identifier === 'plain')
      ?.definition
  ).toBeDefined();
  expect(
    document.references.some((reference) => reference.citation === 'plain')
  ).toBe(false);
});

test('Sources headings have no special relationship semantics', () => {
  const document = parseMarkdownFixture(
    '# Title\n\n## Sources\n\n[ordinary](ordinary.md)\n'
  );
  expect(document.references[0]).toMatchObject({
    origin: 'link',
    section: 'sources',
  });
  expect(document.references[0]?.citation).toBeUndefined();
});

test('missing footnotes retain each unresolved use and located diagnostics', () => {
  const source = '# Title\r\n\r\n😀 [^Missing] and [^missing].\r\n';
  const document = parseMarkdownFixture(source);
  expect(document.footnotes).toHaveLength(1);
  expect(document.footnotes[0]).toMatchObject({ identifier: 'missing' });
  expect(document.footnotes[0]?.definition).toBeUndefined();
  expect(document.footnotes[0]?.uses).toHaveLength(2);
  expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'markdown-footnote-missing',
    'markdown-footnote-missing',
  ]);
  expect(document.diagnostics[0]?.span).toMatchObject({ line: 3, column: 4 });
  expect(document.references).toEqual([]);
});

test.each([
  ['[label](d\\(a\\).md#part "title")', 'd(a).md#part', 'd\\(a\\).md#part'],
  ['[label](d(a).md)', 'd(a).md', 'd(a).md'],
  ['[label](<a b.md>)', 'a b.md', 'a b.md'],
  ['![image](images/a.png)', 'images/a.png', 'images/a.png'],
  ['[**label**](a%20b.md)', 'a%20b.md', 'a%20b.md'],
  ['[`bracket ] code`](a.md)', 'a.md', 'a.md'],
  ['[label](a&amp;b.md)', 'a&b.md', 'a&amp;b.md'],
  ['[label]()', '', ''],
  ['<https://example.com/a>', 'https://example.com/a', 'https://example.com/a'],
])(
  'destination spans preserve authored syntax: %s',
  (link, destination, raw) => {
    const source = `# Unicode\r\n\r\n😀 café ${link}\r\n`;
    const document = parseMarkdownFixture(source);
    const reference = document.references[0];
    expect(document.references).toHaveLength(1);
    expect(document.referencesComplete).toBe(true);
    expect(reference?.destination).toBe(destination);
    expect(sourceSlice(source, reference?.destinationSpan)).toBe(raw);
    expect(reference?.destinationSpan?.line).toBe(3);
    expect(sourceSlice(source, reference?.uses[0])).toBe(link);
  }
);

test('destination offsets remain original UTF-16 positions across generated Unicode prefixes', () => {
  assert(
    property(
      array(constantFrom('é', '😀', 'a', '中', ' '), { maxLength: 50 }),
      (characters) => {
        const prefix = `Content ${characters.join('')}`;
        const source = `# Title\r\n\r\n${prefix}[target](folder/target.md#part)\r\n`;
        const reference = parseMarkdownFixture(source).references[0];
        expect(reference?.destinationSpan?.start).toBe(
          source.indexOf('folder/target.md#part')
        );
        expect(reference?.destinationSpan?.column).toBe(prefix.length + 10);
        expect(sourceSlice(source, reference?.destinationSpan)).toBe(
          'folder/target.md#part'
        );
      }
    ),
    { seed: 202, numRuns: 100 }
  );
});

test('literal backticks in reference labels preserve the actual destination', () => {
  const source = '# Title\n\n[a`]: a`b.md\n\n[a`]\n';
  const document = parseMarkdownFixture(source);
  expect(document.referencesComplete).toBe(true);
  expect(document.references[0]?.destination).toBe('a`b.md');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    'a`b.md'
  );
});

test('an initial BOM never shifts exact destination, heading or citation spans', () => {
  const source =
    '\uFEFF---\r\naliases: [Other]\r\n---\r\n# T\r\n\r\n[^n]\r\n\r\n[^n]: [p](a.md)\r\n';
  const document = parseMarkdownFixture(source);
  expect(document.diagnostics).toEqual([]);
  expect(sourceSlice(source, document.sections[0]?.heading)).toBe('# T');
  expect(sourceSlice(source, document.footnotes[0]?.definition)).toBe(
    '[^n]: [p](a.md)'
  );
  expect(sourceSlice(source, document.footnotes[0]?.uses[0])).toBe('[^n]');
  expect(sourceSlice(source, document.references[0]?.destinationSpan)).toBe(
    'a.md'
  );
});
