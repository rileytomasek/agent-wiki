import { expect, test } from 'vitest';

import { buildMovePlan } from '../src/moves/planning.ts';
import { buildGraph } from '../src/references/graph.ts';
import {
  moveWorkspace,
  planChange,
  plannedWorkspace,
} from './fixtures/move.ts';

test('moves preserve incoming, outgoing, attachment, section and self relationships', () => {
  const source =
    '# T\n\n## Part\n\n[Self](a.md#part) [Here](#part) [Empty]()\n' +
    '[Other](../b.md#part) ![Asset](asset.png#crop) [Missing](missing.md)\n';
  const workspace = moveWorkspace(
    {
      'old/a.md': source,
      'b.md': '# B\n\n## Part\n\n[Target](old/a.md#part)\n',
      'other.md': '# Other\n',
    },
    ['old/asset.png']
  );
  const plan = buildMovePlan(workspace, 'old/a.md', 'new/deep/renamed.md');
  expect(planChange(plan, 'old/a.md').after).toBe(
    '# T\n\n## Part\n\n[Self](renamed.md#part) [Here](#part) [Empty]()\n' +
      '[Other](../../b.md#part) ![Asset](../../old/asset.png#crop) [Missing](../../old/missing.md)\n'
  );
  expect(planChange(plan, 'b.md').after).toBe(
    '# B\n\n## Part\n\n[Target](new/deep/renamed.md#part)\n'
  );
  expect(plan.changes.map((change) => change.path)).toEqual([
    'b.md',
    'old/a.md',
  ]);
  expect(plan.fingerprints).toEqual(
    Object.fromEntries(
      workspace.documents.map(({ document }) => [
        document.path,
        document.sourceHash,
      ])
    )
  );
  expect(plan.files).toEqual(['b.md', 'old/a.md', 'old/asset.png', 'other.md']);
  const graph = buildGraph(plannedWorkspace(workspace, plan));
  expect(graph.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'reference-missing-target',
  ]);
  expect(workspace.documents[0]?.source).toBe(source);
});

test('definitions, repeated citations, containers, comments and CRLF are edited once', () => {
  const source =
    '\uFEFF# Ref\r\n\r\n😀 [One][target] ![Image][target] claim[^proof] claim[^proof].\r\n' +
    '\r\n[^proof]: Explain [citation][target] and [direct](a.md#part).\r\n' +
    '\r\n> [target]:\r\n>   <a.md#part> "Keep this title"\r\n' +
    '\r\n[unused]: a.md#part\r\n\r\n<!-- [ignore](a.md) -->\r\n';
  const plan = buildMovePlan(
    moveWorkspace({
      'a.md': '# A\n\n## Part\n',
      'ref.md': source,
    }),
    'a.md',
    'docs/a new.md'
  );
  const change = planChange(plan, 'ref.md');
  expect(change.edits).toHaveLength(3);
  expect(change.after).toBe(
    source
      .replace('[direct](a.md#part)', '[direct](docs/a%20new.md#part)')
      .replace('<a.md#part>', '<docs/a%20new.md#part>')
      .replace('[unused]: a.md#part', '[unused]: docs/a%20new.md#part')
  );
  expect(change.edits.every((edit) => edit.before === 'a.md#part')).toBe(true);
});

test('unchanged relative and external destinations retain their bytes', () => {
  const source =
    '# A\n\n[Other](./b%2Emd) [Website](https://example.com/a.md?q=1#part)\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'a.md': source, 'b.md': '# B\n' }),
    'a.md',
    'A.md'
  );
  expect(planChange(plan, 'a.md')).toMatchObject({
    destination: 'A.md',
    after: source,
    edits: [],
  });
});

test('explicit path-shaped aliases are safe and literal paths take priority', () => {
  const workspace = moveWorkspace({
    'a.md':
      '---\naliases: [/Alex, "a.md#part", "https://example.com/alex"]\n---\n# A\n',
    'a.md#part.md': '# Literal\n',
  });
  expect(buildMovePlan(workspace, '/Alex', 'new.md').from).toBe('a.md');
  expect(buildMovePlan(workspace, 'a.md#part', 'new.md').from).toBe('a.md');
  expect(
    buildMovePlan(workspace, 'https://example.com/alex', 'new.md').from
  ).toBe('a.md');
  expect(buildMovePlan(workspace, 'a.md#part.md', 'new.md').from).toBe(
    'a.md#part.md'
  );
});

test('unrelated title and value diagnostics do not prevent a safe move', () => {
  const workspace = moveWorkspace({
    'a.md': '# A\n',
    'bad.md': '---\nemail: wrong\n---\n[Target](a.md)\n',
  });
  const plan = buildMovePlan(workspace, 'a.md', 'new.md');
  expect(planChange(plan, 'bad.md').after).toContain('[Target](new.md)');
  expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'frontmatter-value',
    'markdown-title-count',
  ]);
});
