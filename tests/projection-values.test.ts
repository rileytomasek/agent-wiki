import { array, assert, constantFrom, property } from 'fast-check';
import { expect, test } from 'vitest';

import { projectDocument } from '../src/search/projection.ts';
import {
  metadataSnapshot,
  projectedContent,
  projectedHeader,
  projectionSnapshot,
} from './fixtures/projection.ts';

test('all shared fields and reserved metadata project with original body bytes', () => {
  const body =
    '\r\n# Orchid *guide* 😀\r\n\r\nClaim[^n].\r\n\r\n[^n]: Qualified [source](../sources/orchid.md).\r\n';
  const metadata = {
    type: 'custom/guide/extra',
    aliases: ['Orchid', '花'],
    about: ['../projects/orchid.md'],
    stale_after: '2024-02-29',
    url: 'https://example.test/work?q=1#context',
    email: 'author@example.test',
    phone: '+1 555 0123 ext. 4',
    address: '12 Example St\nNew York',
    starts_at: '2026-09-15T14:00:00-04:00',
    ends_at: '2026-09-16',
    published_at: '2026-09-14T10:00Z',
    authors: ['../people/alex.md'],
    participants: ['../people/blair.md'],
    location: '../places/studio.md',
  };
  const snapshot = projectionSnapshot(
    `---\r\n${JSON.stringify(metadata)}\r\n---\r\n${body}`
  );
  const projection = projectDocument(snapshot);
  expect(projection.metadata).toEqual({
    ...metadata,
    about: ['projects/orchid.md'],
    authors: ['people/alex.md'],
    participants: ['people/blair.md'],
    location: 'places/studio.md',
    source_path: 'notes/current.md',
    source_body_line: 4,
    title: 'Orchid guide 😀',
    category: 'custom',
    name: 'guide',
  });
  expect(Object.keys(projection.metadata)).toHaveLength(19);
  expect(projectedContent(projection).endsWith(body)).toBe(true);
  expect(projectedHeader(projection)).toEqual({
    qmd: { metadata: projection.metadata },
  });
  expect(projection.diagnostics).toEqual([]);
});

test('document references are normalized as literal paths without URI decoding', () => {
  const snapshot = metadataSnapshot({
    about: ['../projects/literal%20.md', './sub/../same.md', '../日本語/件.md'],
    authors: ['../people/alex#author.md'],
    participants: ['../people/%2F.md'],
    location: '../places/Mid#Town.md',
  });
  const projection = projectDocument(snapshot);
  expect(projection.metadata).toMatchObject({
    about: ['projects/literal%20.md', 'notes/same.md', '日本語/件.md'],
    authors: ['people/alex#author.md'],
    participants: ['people/%2F.md'],
    location: 'places/Mid#Town.md',
  });
  expect(projection.diagnostics).toEqual([]);
});

test('plain types gain no invented segments and empty arrays are omitted', () => {
  const projection = projectDocument(
    metadataSnapshot({
      type: 'person',
      aliases: [],
      about: [],
      authors: [],
      participants: [],
    })
  );
  expect(projection.metadata).toEqual({
    source_path: 'notes/current.md',
    source_body_line: 4,
    title: 'Orchid',
    type: 'person',
  });
  expect(projection.diagnostics).toEqual([]);
});

test('invalid authored fields do not disable valid metadata or the readable body', () => {
  const snapshot = projectionSnapshot(
    '---\ntype: doc/guide\nemail: not-an-email\nunknown: value\n---\nReadable body without H1.\n'
  );
  const projection = projectDocument(snapshot);
  expect(snapshot.document.diagnostics.map((item) => item.code)).toEqual([
    'frontmatter-value',
    'frontmatter-unknown',
    'markdown-title-count',
  ]);
  expect(projection.metadata).toEqual({
    source_path: 'notes/current.md',
    source_body_line: 6,
    title: 'current.md',
    type: 'doc/guide',
    category: 'doc',
    name: 'guide',
  });
  expect(projectedContent(projection)).toContain('Readable body without H1.\n');
  expect(projection.diagnostics).toEqual([]);
});

test.each([
  '# Plain\n\nBody\n',
  '---\nabout: [\n# Unterminated readable content\n',
])(
  'missing or unusable frontmatter preserves readable source: %s',
  (source) => {
    const projection = projectDocument(projectionSnapshot(source));
    expect(projectedContent(projection).endsWith(source)).toBe(true);
    expect(projection.metadata['source_body_line']).toBe(1);
    expect(projectedHeader(projection)).toEqual({
      qmd: { metadata: projection.metadata },
    });
  }
);

test('projection is deterministic, order-independent, and does not mutate snapshots', () => {
  assert(
    property(
      array(constantFrom('é', '😀', '"', '\\', '\n', '\r', '\0', ' '), {
        maxLength: 60,
      }),
      (characters) => {
        const value = `Name ${characters.join('')}`;
        const first = metadataSnapshot({
          aliases: [value],
          address: value,
          stale_after: '2026-09-15',
        });
        const reordered = metadataSnapshot({
          stale_after: '2026-09-15',
          address: value,
          aliases: [value],
        });
        const before = JSON.stringify(first);
        const projection = projectDocument(first);
        expect(projection).toEqual(projectDocument(first));
        expect(projectedContent(projection)).toBe(
          projectedContent(projectDocument(reordered))
        );
        expect(projectedHeader(projection)).toEqual({
          qmd: { metadata: projection.metadata },
        });
        expect(JSON.stringify(first)).toBe(before);
        expect(projection.metadata).not.toHaveProperty('stale');
        expect(projection.metadata).not.toHaveProperty('indexed_at');
      }
    ),
    { seed: 205, numRuns: 100 }
  );
});
