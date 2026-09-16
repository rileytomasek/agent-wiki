import { expect, test } from 'vitest';

import { buildGraph } from '../src/references/graph.ts';
import { findGraphTarget } from '../src/references/lookup.ts';
import { fixtureGraph, graphInput } from './fixtures/graph.ts';

test('lookup keeps literal file identity and supports explicitly declared unusual aliases', () => {
  const graph = fixtureGraph(
    {
      'a#b.md': '# Hash\n\n## Café\n',
      'a%20b.md': '# Percent\n',
      'other.md':
        '---\naliases: [/Alex, ../Alex, .hidden.md, Alias#part]\n---\n# Other\n',
    },
    ['assets/image.png']
  );
  expect(findGraphTarget(graph, 'a#b.md')).toMatchObject({
    status: 'resolved',
    target: { path: 'a#b.md', kind: 'document' },
  });
  expect(findGraphTarget(graph, 'a#b.md#caf%C3%A9')).toMatchObject({
    status: 'resolved',
    target: { path: 'a#b.md', anchor: 'café' },
  });
  expect(findGraphTarget(graph, 'a%20b.md')).toMatchObject({
    status: 'resolved',
    target: { path: 'a%20b.md' },
  });
  for (const alias of ['/Alex', '../Alex', '.hidden.md', 'Alias#part']) {
    expect(findGraphTarget(graph, alias)).toMatchObject({
      status: 'resolved',
      target: { path: 'other.md' },
    });
  }
  expect(findGraphTarget(graph, 'assets/image.png')).toMatchObject({
    status: 'resolved',
    target: { kind: 'attachment' },
  });
});

test('alias ambiguity and incomplete coverage never select an arbitrary match', () => {
  const input = graphInput({
    'a.md': '---\naliases: [Shared, Unique]\n---\n# A\n',
    'b.md': '---\naliases: [Shared]\n---\n# B\n',
  });
  expect(findGraphTarget(buildGraph(input), 'Shared')).toEqual({
    status: 'ambiguous',
    candidates: ['a.md', 'b.md'],
  });
  expect(
    findGraphTarget(buildGraph({ ...input, complete: false }), 'Unique')
  ).toEqual({ status: 'unresolved', reason: 'incomplete' });
  expect(findGraphTarget(buildGraph(input), 'A')).toEqual({
    status: 'unresolved',
    reason: 'missing',
  });
});

test('lookup handles empty external neighborhoods and invalid or missing anchors', () => {
  const graph = fixtureGraph({ 'a.md': '# A\n' });
  expect(
    findGraphTarget(graph, 'https://example.com/new?q=1#part')
  ).toMatchObject({ status: 'resolved', target: { kind: 'external' } });
  expect(findGraphTarget(graph, 'a.md#missing')).toEqual({
    status: 'unresolved',
    reason: 'anchor-missing',
  });
  expect(findGraphTarget(graph, 'a.md#%bad')).toEqual({
    status: 'unresolved',
    reason: 'anchor-invalid',
  });
  expect(findGraphTarget(graph, 'https://')).toEqual({
    status: 'unresolved',
    reason: 'invalid',
  });
});
