import { expect, test } from 'vitest';

import { parseFrontmatter } from '../../src/documents/frontmatter.ts';
import type { Reference } from '../../src/documents/types.ts';

function parse(source: string) {
  return parseFrontmatter({
    path: 'notes/current.md',
    sourceHash: 'test',
    source,
  });
}

function destinationText(source: string, reference: Reference): string {
  const span = reference.destinationSpan;
  if (span === undefined) throw new Error('Expected editable destination');
  return source.slice(span.start, span.end);
}

test.each(['# Body\n', '\n---\ntype: doc/guide\n---\n# Body\n'])(
  'frontmatter is optional and recognized only at the beginning',
  (source) => {
    const result = parse(source);
    expect(result.metadata).toEqual({});
    expect(result.body).toEqual({
      start: 0,
      end: source.length,
      line: 1,
      column: 1,
    });
    expect(result.diagnostics).toEqual([]);
  }
);

test.each(['---\n---\n', '\uFEFF---\r\n# comment\r\n...\r\n'])(
  'an empty leading block retains every following body byte',
  (header) => {
    const body = '\r\n# 日本語 😀\r\n\r\nOriginal body\r\n';
    const source = header + body;
    const result = parse(source);
    expect(result.metadata).toEqual({});
    expect(source.slice(result.body.start, result.body.end)).toBe(body);
    expect(result.diagnostics).toEqual([]);
  }
);

test('malformed terminated YAML reports its location and preserves the body', () => {
  const source = '---\r\ntype: [\r\n---\r\n# Usable\r\nText\r\n';
  const result = parse(source);
  expect(result.metadata).toEqual({});
  expect(result.diagnostics).toMatchObject([
    {
      code: 'frontmatter-yaml',
      path: 'notes/current.md',
      span: { line: 3 },
    },
  ]);
  expect(source.slice(result.body.start)).toBe('# Usable\r\nText\r\n');
  expect(result.referencesComplete).toBe(false);
});

test('a lone CR line ending preserves YAML scalar offsets', () => {
  const source = '---\rlocation: ../place.md\r---\r# Body';
  const result = parse(source);
  expect(result.metadata).toEqual({ location: '../place.md' });
  expect(result.diagnostics).toEqual([]);
  expect(result.body.line).toBe(4);
  expect(
    result.references.map((reference) => destinationText(source, reference))
  ).toEqual(['../place.md']);
  expect(result.references[0]?.destinationSpan).toMatchObject({
    line: 2,
    column: 11,
  });
});

test.each([
  '---',
  '---\nabout: [missing.md]\n# Body without closing separator\n',
])('unterminated YAML never discards readable source', (source) => {
  const result = parse(source);
  expect(result.body.start).toBe(0);
  expect(result.body.end).toBe(source.length);
  expect(result.diagnostics).toEqual([
    expect.objectContaining({ code: 'frontmatter-unclosed' }),
  ]);
  expect(result.referencesComplete).toBe(false);
});

test.each(['a scalar', '[an, array]', '12'])(
  'frontmatter must be a mapping: %s',
  (yaml) => {
    const result = parse(`---\n${yaml}\n---\n# Body`);
    expect(result.metadata).toEqual({});
    expect(result.diagnostics[0]?.code).toBe('frontmatter-shape');
  }
);

test('non-string YAML keys and unresolved tags produce structural diagnostics', () => {
  expect(parse('---\n2: value\n---\n# Body').diagnostics[0]?.code).toBe(
    'frontmatter-key'
  );
  expect(
    parse('---\ntype: !custom person\n---\n# Body').diagnostics[0]?.code
  ).toBe('frontmatter-yaml');
});

test('YAML scalar spans retain quotes, escapes, CRLF, and block style', () => {
  const source = [
    '---',
    'aliases: ["😀"]',
    'about: [\'../café.md\', "../people/\\u0061lex.md"] # comment',
    'url: https://example.test/page#fragment # primary',
    'location: |- # preserve this comment',
    '  ../places/studio.md',
    '---',
    '# Body',
    '',
  ].join('\r\n');
  const result = parse(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.references.map((reference) => reference.syntax)).toEqual([
    'yaml-single',
    'yaml-double',
    'yaml-plain',
    'yaml-block',
  ]);
  expect(result.references.map((reference) => reference.destination)).toEqual([
    '../café.md',
    '../people/alex.md',
    'https://example.test/page#fragment',
    '../places/studio.md',
  ]);
  expect(
    result.references.map((reference) => destinationText(source, reference))
  ).toEqual([
    "'../café.md'",
    '"../people/\\u0061lex.md"',
    'https://example.test/page#fragment',
    '|- # preserve this comment\r\n  ../places/studio.md\r\n',
  ]);
  expect(result.references[0]?.destinationSpan).toMatchObject({
    line: 3,
    column: 9,
  });
  expect(result.references[0]?.uses).toEqual([
    result.references[0]?.destinationSpan,
  ]);
});

test('duplicate reference fields stay editable even when metadata is ambiguous', () => {
  const result = parse('---\nabout: [../a.md]\nabout: [../b.md]\n---\n# Body');
  expect(result.metadata).toEqual({});
  expect(result.references.map((reference) => reference.destination)).toEqual([
    '../a.md',
    '../b.md',
  ]);
  expect(result.referencesComplete).toBe(true);
});

test('YAML aliases normalize for reads and refuse ambiguous shared destination edits', () => {
  const result = parse(
    '---\ntype: &kind person\naliases: [*kind]\nabout: &subjects [../a.md]\nauthors: *subjects\nlocation: &place ../place.md\n---\n# Body'
  );
  expect(result.metadata).toEqual({
    type: 'person',
    aliases: ['person'],
    about: ['../a.md'],
    authors: ['../a.md'],
    location: '../place.md',
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.referencesComplete).toBe(false);
  expect(result.references[1]).toMatchObject({
    field: 'authors',
    destination: '../a.md',
  });
  expect(result.references[1]).not.toHaveProperty('destinationSpan');
  expect(result.references[2]).not.toHaveProperty('destinationSpan');
});

test('unresolved and recursive aliases cannot manufacture valid strings', () => {
  const result = parse(
    '---\nabout: [*missing]\naliases: &cycle [*cycle]\n---\n# Body'
  );
  expect(result.metadata).toEqual({});
  expect(result.diagnostics.map((item) => item.code)).toEqual([
    'frontmatter-value',
    'frontmatter-value',
  ]);
  expect(result.referencesComplete).toBe(false);
});
