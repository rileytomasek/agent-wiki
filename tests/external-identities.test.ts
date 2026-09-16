import { array, assert, constantFrom, integer, property } from 'fast-check';
import { expect, test } from 'vitest';

import { externalIdentity } from '../src/references/external.ts';
import type { ExternalIdentity } from '../src/references/external.ts';
import { findGraphTarget } from '../src/references/lookup.ts';
import { fixtureGraph } from './fixtures/graph.ts';

function identity(url: string): ExternalIdentity {
  const result = externalIdentity(url);
  if (result === undefined) throw new Error(`Unrecognized URL: ${url}`);
  return result;
}

test('generic query order, repetition, encodings and empty selectors retain distinct identities', () => {
  const urls = [
    'https://example.test/path?a=1&b=2',
    'https://example.test/path?b=2&a=1',
    'https://example.test/path?a=1&a=2',
    'https://example.test/path?a=2&a=1',
    'https://example.test/path?q=a+b',
    'https://example.test/path?q=a%20b',
    'https://example.test/path?',
    'https://example.test/path#',
    'https://example.test/path?#',
    'https://example.test/path',
  ];
  expect(urls.map((url) => identity(url).target.url)).toEqual(urls);
  expect(new Set(urls.map((url) => identity(url).target.id)).size).toBe(
    urls.length
  );
});

test('generic host, path, query and fragment distinctions remain independent', () => {
  assert(
    property(integer({ min: 0, max: 100_000 }), (number) => {
      const urls = [
        `https://example.test/Path?id=${number}#first`,
        `https://other.test/Path?id=${number}#first`,
        `https://example.test/path?id=${number}#first`,
        `https://example.test/Path?id=${number + 1}#first`,
        `https://example.test/Path?id=${number}#second`,
        `https://example.test/Path?id=${number}#First`,
        `https://example.test/Path?id=${number}&id=${number}#first`,
      ];
      expect(new Set(urls.map((url) => identity(url).target.id)).size).toBe(
        urls.length
      );
    }),
    { seed: 20_408, numRuns: 100 }
  );
});

test.each([
  'https://github.com.evil.test/o/r/pull/12',
  'https://github.example/o/r/pull/12',
  'https://user@github.com/o/r/pull/12',
  'https://github.com:8443/o/r/pull/12',
  'ftp://github.com/o/r/pull/12',
  '//github.com/o/r/pull/12',
])('keeps unrecognized GitHub-like authorities generic: %s', (url) => {
  const result = identity(url);
  expect(result.target.provider).toBeUndefined();
  expect(result.target.url).toBe(url);
  expect(result.target.id).not.toBe(
    identity('https://github.com/o/r/pull/12').target.id
  );
});

test.each([
  'pull/0',
  'pull/012',
  'pull/12/files',
  'issues/new',
  'commit/abcdef',
  'blob/main',
  'blob/main/',
  'blob//path.md',
  'blob/main/path.md/',
])(
  'falls back conservatively for incomplete or unknown resource forms: %s',
  (path) => {
    const url = `https://github.com/Owner/Repo/${path}?view=1#part`;
    expect(identity(url).target).toEqual({
      id: `external:${url}`,
      kind: 'external',
      url,
    });
  }
);

test('GitHub file identity preserves ref, path case and encoded separators', () => {
  const paths = [
    'main/Path.md',
    'Main/Path.md',
    'main/path.md',
    'main/dir%2Ffile.md',
    'main/dir/file.md',
    'feature/branch/path.md',
  ];
  const identities = paths.map(
    (path) => identity(`https://github.com/Owner/Repo/blob/${path}`).target
  );
  expect(identities.map((target) => target.url)).toEqual(
    paths.map((path) => `https://github.com/owner/repo/blob/${path}`)
  );
  expect(new Set(identities.map((target) => target.id)).size).toBe(
    paths.length
  );
});

test.each(['?', '#', '?#', '?view=split#', '?#discussion'])(
  'preserves even empty authored GitHub selector components: %s',
  (selector) => {
    const base = 'https://github.com/Owner/Repo/pull/12';
    expect(identity(base + selector)).toEqual({
      target: identity(base).target,
      selector,
    });
  }
);

test('generated recognized resource occurrences converge without losing authored selectors', () => {
  assert(
    property(
      constantFrom(
        'pull/12',
        'issues/99',
        'commit/aBc0123',
        'blob/Main/Path.md'
      ),
      array(integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 20 }),
      (resource, numbers) => {
        const base = `https://github.com/owner/repo/${resource}`;
        const selectors = numbers.map(
          (number, index) => `?view=${number}#part-${index}`
        );
        const urls = selectors.map(
          (selector) => `http://GitHub.com/OWNER/Repo/${resource}${selector}`
        );
        const graph = fixtureGraph({
          'source.md':
            '# Source\n\n' + urls.map((url) => `[link](${url})`).join(' '),
        });
        const target = identity(base).target;
        expect(graph.incoming.get(target.id)).toHaveLength(urls.length);
        expect(
          graph.references.map((entry) => entry.reference.destination)
        ).toEqual(urls);
        expect(graph.references.map((entry) => entry.resolution)).toEqual(
          selectors.map((selector) => ({
            status: 'resolved',
            target,
            selector,
          }))
        );
        expect(findGraphTarget(graph, base)).toEqual({
          status: 'resolved',
          target,
        });
        expect(graph.complete).toBe(true);
        expect(graph.diagnostics).toEqual([]);
      }
    ),
    { seed: 20_407, numRuns: 100 }
  );
});

test('primary URL, image, ordinary link and citation retain origins and source locations', () => {
  const base = 'https://github.com/Owner/Repo/pull/12';
  const source = [
    '---',
    `url: ${base}?primary=1#top`,
    '---',
    '# Source',
    '',
    `[Discussion](${base}#discussion) ![Preview](${base}?preview=1) Claim[^proof].`,
    '',
    `[^proof]: Qualified [Evidence](${base}#review).`,
    '',
  ].join('\n');
  const graph = fixtureGraph({ 'source.md': source });
  const incoming = graph.incoming.get(identity(base).target.id);
  expect(incoming?.map((entry) => entry.reference.origin)).toEqual([
    'frontmatter',
    'link',
    'image',
    'citation',
  ]);
  expect(incoming?.map((entry) => entry.use?.line)).toEqual([2, 6, 6, 6]);
  expect(
    incoming?.map((entry) => entry.reference.destinationSpan?.line)
  ).toEqual([2, 6, 6, 8]);
  expect(incoming?.[0]?.reference.field).toBe('url');
  expect(incoming?.[3]?.reference.citation).toBe('proof');
  expect(graph.diagnostics).toEqual([]);
});

test.each([
  'mailto:Person+tag@example.test?subject=A%20B#part',
  'tel:+15551234567;ext=12',
  'urn:isbn:9780141187761',
  'custom+scheme:opaque?query#section',
  'data:text/plain,hello#part',
])(
  'keeps a non-HTTP reference addressable without provider inference: %s',
  (url) => {
    const target = identity(url).target;
    const graph = fixtureGraph({
      'source.md': `# Source\n\n[Target](${url})\n`,
    });
    expect(target).toEqual({ id: `external:${url}`, kind: 'external', url });
    expect(findGraphTarget(graph, url)).toEqual({ status: 'resolved', target });
    expect(graph.incoming.get(target.id)).toHaveLength(1);
    expect(graph.diagnostics).toEqual([]);
  }
);

test.each([
  '',
  'local.md',
  '../local.md',
  '#section',
  'https://',
  'https://[::1',
  'https://example.test:wrong/path',
  'https://example.test:99999/path',
  'https://exa mple.test/path',
  '//',
])('rejects invalid external URLs without inventing a target: %s', (url) => {
  expect(externalIdentity(url)).toBeUndefined();
});
