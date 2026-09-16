import { expect, test } from 'vitest';

import { parseFrontmatter } from '../../src/documents/frontmatter.ts';

function parse(yaml: string) {
  return parseFrontmatter({
    path: 'notes/current.md',
    sourceHash: 'test',
    source: `---\n${yaml}\n---\n# Readable\n`,
  });
}

test('all shared fields retain authored values without a type-specific schema', () => {
  const result = parse(
    [
      'type: custom/label/extension',
      'aliases: [Alex, "Dr. Alex"]',
      'about: [../projects/orchid.md]',
      'stale_after: 2024-02-29',
      'url: https://example.test/alex?q=1#bio',
      'email: alex+wiki@example.test',
      'phone: "+1 555 0100 ext. 42"',
      'address: |-\n  12 Example Street\n  New York, NY',
      'starts_at: 2026-09-15T14:00:00-04:00',
      'ends_at: 2026-09-16',
      'published_at: 2026-09-14T10:30Z',
      'authors: [../people/alex.md]',
      'participants: [../people/blair.md]',
      'location: ../places/studio.md',
    ].join('\n')
  );
  expect(result.metadata).toEqual({
    type: 'custom/label/extension',
    aliases: ['Alex', 'Dr. Alex'],
    about: ['../projects/orchid.md'],
    stale_after: '2024-02-29',
    url: 'https://example.test/alex?q=1#bio',
    email: 'alex+wiki@example.test',
    phone: '+1 555 0100 ext. 42',
    address: '12 Example Street\nNew York, NY',
    starts_at: '2026-09-15T14:00:00-04:00',
    ends_at: '2026-09-16',
    published_at: '2026-09-14T10:30Z',
    authors: ['../people/alex.md'],
    participants: ['../people/blair.md'],
    location: '../places/studio.md',
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.referencesComplete).toBe(true);
  expect(result.references.map((reference) => reference.field)).toEqual([
    'about',
    'url',
    'authors',
    'participants',
    'location',
  ]);
});

test.each([
  'type: /person',
  'type: entity/',
  'type: entity//person',
  'type: "  "',
  'type: 15',
  'aliases: Alex',
  'aliases: [Alex, " "]',
  'about: [Alex]',
  'about: [../ok.md, 7]',
  'about: [../../outside.md]',
  'about: [/outside.md]',
  'about: [https://example.test/a.md]',
  'about: [../a.md#section]',
  'stale_after: 2026-02-29',
  'stale_after: 2024-2-29',
  'url: /relative',
  'url: ftp://example.test/file',
  'url: https://',
  'email: not-an-email',
  'email: "alex @example.test"',
  'email: alex@example..test',
  'email: .alex@example.test',
  'email: alex.@example.test',
  'email: alex@-example.test',
  'phone: 15550100',
  'phone: ""',
  'address: null',
  'address: [Street]',
  'starts_at: 2026-09-15T14:00:00',
  'starts_at: 2026-02-30T14:00:00Z',
  'ends_at: 2026-09-15T25:00:00Z',
  'ends_at: yesterday',
  'published_at: 2026-09-15T14:61:00+00:00',
  'authors: Person',
  'authors: [person]',
  'participants: false',
  'location: ""',
  'location: places/studio',
  'location: [place.md]',
])('rejects invalid values without losing readable content: %s', (yaml) => {
  const result = parse(`${yaml}\naddress: Kept`);
  expect(result.metadata).not.toHaveProperty(yaml.slice(0, yaml.indexOf(':')));
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'frontmatter-value', severity: 'error' })
  );
  expect(result.body.line).toBe(5);
});

test.each([
  'type: person',
  'type: team/custom-name',
  'type: team/custom/extra',
  'aliases: []',
  'about: []',
  'participants: []',
  'about: [../日本語%20place.md]',
  'about: ["../literal%20name.md", "../with#mark.md"]',
  'phone: "(555) 123-4567 x12"',
  'stale_after: 2000-02-29',
  'ends_at: 2026-09-15T14:00:00.123+05:30',
])('accepts open vocabulary and declared precision: %s', (yaml) => {
  expect(parse(yaml).diagnostics).toEqual([]);
});

test('unknown, duplicate, and invalid fields are independent', () => {
  const result = parse(
    'type: entity/person\ntype: doc/guide\ncustom_status: active\nemail: broken\nphone: "555"'
  );
  expect(result.metadata).toEqual({ phone: '555' });
  expect(result.diagnostics.map((item) => item.code)).toEqual([
    'frontmatter-duplicate',
    'frontmatter-duplicate',
    'frontmatter-unknown',
    'frontmatter-value',
  ]);
  expect(result.referencesComplete).toBe(true);
});

test('invalid reference values preserve known occurrences but prohibit uncertain moves', () => {
  const result = parse('about: [../known.md, false]\nemail: invalid');
  expect(result.metadata).toEqual({});
  expect(result.references).toEqual([
    expect.objectContaining({ destination: '../known.md', field: 'about' }),
  ]);
  expect(result.referencesComplete).toBe(false);
});
