import { array, assert, integer, property } from 'fast-check';
import { expect, test } from 'vitest';

import { buildGraph } from '../src/references/graph.ts';
import { localTargetId } from '../src/references/targets.ts';
import { fixtureGraph, graphInput } from './fixtures/graph.ts';

test('relative URI paths, literal YAML paths, fragments and attachments resolve distinctly', () => {
  const graph = fixtureGraph(
    {
      'notes/source.md':
        '---\nabout: [../targets/a%20b.md]\n---\n# Source\n\n## Same\n\n## Same\n\n[self](#same-1) [space](../targets/a%20b.md#caf%C3%A9) [percent](../targets/a%2520b.md) ![image](../assets/a%20b.png#view)\n',
      'targets/a b.md': '# Space\n\n## Café\n',
      'targets/a%20b.md': '# Literal percent\n',
    },
    ['assets/a b.png']
  );
  expect(graph.diagnostics).toEqual([]);
  expect(
    graph.references.map((occurrence) => occurrence.resolution)
  ).toMatchObject([
    {
      status: 'resolved',
      target: { kind: 'document', path: 'targets/a%20b.md' },
    },
    {
      status: 'resolved',
      target: { kind: 'section', path: 'notes/source.md', anchor: 'same-1' },
    },
    {
      status: 'resolved',
      target: { kind: 'section', path: 'targets/a b.md', anchor: 'café' },
    },
    {
      status: 'resolved',
      target: { kind: 'document', path: 'targets/a%20b.md' },
    },
    {
      status: 'resolved',
      target: { kind: 'attachment', path: 'assets/a b.png' },
      selector: '#view',
    },
  ]);
  expect(graph.incoming.get(localTargetId('targets/a b.md'))).toHaveLength(1);
  expect(
    graph.incoming.get(localTargetId('targets/a b.md', 'café'))
  ).toHaveLength(1);
});

test('shared definitions and repeated citations retain separate uses and a shared editable span', () => {
  const source =
    '# Source\n\n## One\n\n[a][shared] [b][shared] Claim[^proof].\n\n## Two\n\nAgain[^proof].\n\n[^proof]: Qualified [citation](target.md).\n\n[shared]: target.md\n[unused]: spare.md\n';
  const graph = fixtureGraph({
    'source.md': source,
    'target.md': '# Target\n',
    'spare.md': '# Spare\n',
  });
  const shared = graph.references.filter(
    (occurrence) => occurrence.reference.definition === 'shared'
  );
  expect(shared).toHaveLength(2);
  expect(shared[0]?.reference).toBe(shared[1]?.reference);
  expect(shared[0]?.reference.destinationSpan).toEqual(
    shared[1]?.reference.destinationSpan
  );
  const citations = graph.references.filter(
    (occurrence) => occurrence.reference.origin === 'citation'
  );
  expect(citations.map((occurrence) => occurrence.sourceSection)).toEqual([
    'one',
    'two',
  ]);
  expect(graph.outgoing.get(localTargetId('source.md'))).toHaveLength(4);
  expect(graph.outgoing.get(localTargetId('source.md', 'source'))).toHaveLength(
    4
  );
  expect(
    graph.references.find(
      (occurrence) => occurrence.reference.definition === 'unused'
    )?.active
  ).toBe(false);
  expect(graph.incoming.get(localTargetId('spare.md'))).toBeUndefined();
});

test('unresolved facts retain authored values, use locations and precise failure reasons', () => {
  const graph = fixtureGraph({
    'source.md':
      '# Source\n\n[missing](gone.md) [anchor](target.md#gone) [escape](../outside.md) [encoded](bad%ZZ.md) [alias](Named.md)\n',
    'target.md': '---\naliases: [Named.md]\n---\n# Target\n',
  });
  expect(graph.references.map((occurrence) => occurrence.resolution)).toEqual([
    { status: 'unresolved', reason: 'missing-target', path: 'gone.md' },
    {
      status: 'unresolved',
      reason: 'missing-anchor',
      path: 'target.md',
      anchor: 'gone',
    },
    { status: 'unresolved', reason: 'invalid-destination' },
    { status: 'unresolved', reason: 'invalid-destination' },
    { status: 'unresolved', reason: 'missing-target', path: 'Named.md' },
  ]);
  expect(graph.outgoing.get(localTargetId('source.md'))).toHaveLength(5);
  expect(graph.diagnostics).toHaveLength(5);
  expect(graph.diagnostics.map((diagnostic) => diagnostic.span?.line)).toEqual([
    3, 3, 3, 3, 3,
  ]);
});

test('unreadable and unvisited targets are unknown rather than confirmed missing', () => {
  const input = graphInput({
    'source.md': '# Source\n\n[read](unreadable.md) [scan](unvisited/doc.md)\n',
  });
  const graph = buildGraph({
    ...input,
    files: [...input.files, 'unreadable.md'],
    unavailable: ['unvisited'],
    complete: false,
  });
  expect(graph.references.map((occurrence) => occurrence.resolution)).toEqual([
    {
      status: 'unresolved',
      reason: 'unavailable-target',
      path: 'unreadable.md',
    },
    {
      status: 'unresolved',
      reason: 'unavailable-target',
      path: 'unvisited/doc.md',
    },
  ]);
  expect(graph.complete).toBe(false);
});

test('adjacency agrees with every generated repeated local occurrence', () => {
  assert(
    property(
      array(integer({ min: 0, max: 12 }), { minLength: 1, maxLength: 40 }),
      (numbers) => {
        const links = numbers
          .map((number) => `[n](target.md#part-${number})`)
          .join(' ');
        const graph = fixtureGraph({
          'source.md': `# Source\n\n${links}\n`,
          'target.md':
            '# Target\n\n' +
            Array.from({ length: 13 }, (_, number) => `## Part ${number}`).join(
              '\n\n'
            ),
        });
        const incoming = graph.incoming.get(localTargetId('target.md'));
        const outgoing = graph.outgoing.get(localTargetId('source.md'));
        expect(incoming?.map((occurrence) => occurrence.id)).toEqual(
          outgoing?.map((occurrence) => occurrence.id)
        );
        expect(incoming).toHaveLength(numbers.length);
        expect(new Set(incoming?.map((occurrence) => occurrence.id)).size).toBe(
          numbers.length
        );
        expect(graph.diagnostics).toEqual([]);
      }
    ),
    { seed: 204, numRuns: 75 }
  );
});
