import { array, assert, constantFrom, property } from 'fast-check';
import { expect, test } from 'vitest';

import { buildMovePlan } from '../src/moves/planning.ts';
import { buildGraph } from '../src/references/graph.ts';
import type { ReferenceGraph } from '../src/references/types.ts';
import {
  moveWorkspace,
  planChange,
  plannedWorkspace,
} from './fixtures/move.ts';

function localTargets(graph: ReferenceGraph): readonly string[] {
  return graph.references
    .map(({ resolution }) => {
      if (
        resolution.status !== 'resolved' ||
        resolution.target.kind === 'external'
      )
        throw new Error('Expected a resolved local fixture target');
      return (
        resolution.target.path +
        (resolution.target.anchor === undefined
          ? ''
          : `#${resolution.target.anchor}`)
      );
    })
    .toSorted();
}

test('path variations preserve all graph targets, occurrences and unrelated text', () => {
  const name = array(
    constantFrom('a', 'Z', ' ', 'é', '😀', '%', '#', '(', ')'),
    { minLength: 1, maxLength: 12 }
  ).map((parts) => parts.join(''));
  assert(
    property(name, name, (directory, file) => {
      const to = `new${directory}/${file}.md`;
      const source =
        '# A\r\n\r\n## Part\r\n\r\n[Other](../b.md) [Self](#part)\r\n';
      const workspace = moveWorkspace({
        'old/a.md': source,
        'b.md': '# B\n\n[From](old/a.md#part)\n',
      });
      const plan = buildMovePlan(workspace, 'old/a.md', to);
      const graph = buildGraph(plannedWorkspace(workspace, plan));
      expect(graph.diagnostics).toEqual([]);
      expect(localTargets(graph)).toEqual(
        ['b.md', `${to}#part`, `${to}#part`].toSorted()
      );
      expect(planChange(plan, 'old/a.md').after).toBe(
        '# A\r\n\r\n## Part\r\n\r\n[Other](../b.md) [Self](#part)\r\n'
      );
    }),
    { seed: 207, numRuns: 150 }
  );
});
