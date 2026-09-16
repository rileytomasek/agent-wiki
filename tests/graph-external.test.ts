import { expect, test } from 'vitest';

import { externalIdentity } from '../src/references/external.ts';
import { fixtureGraph } from './fixtures/graph.ts';

test('recognized GitHub resources converge while retaining each authored selector', () => {
  const graph = fixtureGraph({
    'one.md':
      '# One\n\n[PR](https://github.com/Owner/Repo/pull/12#discussion-one)\n',
    'two.md':
      '---\nurl: https://github.com/owner/repo/pull/12?diff=split#discussion-two\n---\n# Two\n',
  });
  const targets = [...graph.targets.values()].filter(
    (target) => target.kind === 'external'
  );
  expect(targets).toEqual([
    {
      id: 'github:github.com:owner/repo:pull/12',
      kind: 'external',
      provider: 'github',
      host: 'github.com',
      namespace: 'owner/repo',
      resource: 'pull-request',
      url: 'https://github.com/owner/repo/pull/12',
    },
  ]);
  expect(
    graph.incoming.get('github:github.com:owner/repo:pull/12')
  ).toHaveLength(2);
  expect(
    graph.references.map((occurrence) => occurrence.resolution)
  ).toMatchObject([
    { status: 'resolved', selector: '#discussion-one' },
    { status: 'resolved', selector: '?diff=split#discussion-two' },
  ]);
  expect(graph.references[1]?.reference).toMatchObject({
    origin: 'frontmatter',
    field: 'url',
  });
});

test.each([
  ['https://github.com/o/r/issues/12#issuecomment-1', 'issue'],
  ['https://github.com/o/r/commit/ABC1234#diff-1', 'commit'],
  ['https://github.com/o/r/blob/feature/branch/path.md#L10-L20', 'file'],
])('recognizes resource semantics offline: %s', (url, resource) => {
  expect(externalIdentity(url)?.target).toMatchObject({
    provider: 'github',
    resource,
    host: 'github.com',
    namespace: 'o/r',
  });
});

test('distinct providers, namespaces and GitHub resource classes never collapse', () => {
  const urls = [
    'https://github.com/owner/repo/pull/12',
    'https://github.com/owner/repo/issues/12',
    'https://github.com/other/repo/pull/12',
    'https://github.enterprise/owner/repo/pull/12',
    'https://github.com:8443/owner/repo/pull/12',
    'https://github.com/owner/repo/blob/main/Path.md',
    'https://github.com/owner/repo/blob/main/path.md',
  ];
  expect(
    new Set(urls.map((url) => externalIdentity(url)?.target.id)).size
  ).toBe(urls.length);
  expect(
    externalIdentity('https://github.enterprise/owner/repo/pull/12')?.target
      .provider
  ).toBeUndefined();
});

test('generic queries, fragments, protocol-relative URLs and non-HTTP references retain identity', () => {
  const urls = [
    'https://example.com/work?id=1#part',
    'https://example.com/work?id=2#part',
    'https://example.com/work?id=1#other',
    '//example.com/work?id=1#part',
    'mailto:Person@example.com',
    'mailto:person@example.com',
    'custom:opaque#one',
  ];
  expect(urls.map((url) => externalIdentity(url)?.target.url)).toEqual(urls);
  expect(
    new Set(urls.map((url) => externalIdentity(url)?.target.id)).size
  ).toBe(urls.length);
  expect(externalIdentity('https://')).toBeUndefined();
});
