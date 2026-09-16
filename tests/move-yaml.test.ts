import { expect, test } from 'vitest';

import { buildMovePlan } from '../src/moves/planning.ts';
import { moveWorkspace, planChange } from './fixtures/move.ts';

test('named frontmatter fields retain scalar styles, comments and other bytes', () => {
  const source =
    "---\r\nabout: [a.md] # about\r\nauthors: ['a.md'] # authors\r\n" +
    'participants:\r\n  - "a.md" # participant\r\nlocation: >- # place\r\n  a.md\r\n' +
    'url: https://example.com/a.md\r\ntype: entity/source\r\n---\r\n# Ref\r\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'a.md': '# A\n', 'ref.md': source }),
    'a.md',
    'places/new name.md'
  );
  const change = planChange(plan, 'ref.md');
  expect(change.edits).toHaveLength(4);
  expect(change.after).toBe(
    source
      .replace('[a.md]', '[places/new name.md]')
      .replace("['a.md']", "['places/new name.md']")
      .replace('"a.md"', '"places/new name.md"')
      .replace('  a.md\r\n', '  places/new name.md\r\n')
  );
});

test('moving a source rebases its literal named document paths', () => {
  const source = "---\nabout: [../b.md]\nlocation: 'a.md'\n---\n# A\n";
  const plan = buildMovePlan(
    moveWorkspace({ 'old/a.md': source, 'b.md': '# B\n' }),
    'old/a.md',
    'new/deep/name.md'
  );
  expect(planChange(plan, 'old/a.md').after).toBe(
    "---\nabout: [../../b.md]\nlocation: 'name.md'\n---\n# A\n"
  );
});

test('filenames resembling URI schemes remain literal in named YAML fields', () => {
  const source = '---\nabout: [a.md, \'a.md\', "a.md"]\n---\n# R\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'a.md': '# A\n', 'ref.md': source }),
    'a.md',
    'note:new.md'
  );
  expect(planChange(plan, 'ref.md').after).toBe(
    '---\nabout: [./note:new.md, \'./note:new.md\', "./note:new.md"]\n---\n# R\n'
  );
});

test('folded path values keep their style, explicit indent and header comments', () => {
  const source = '---\nlocation: >2- # header\n  old\n  name.md\n---\n# R\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'old name.md': '# A\n', 'ref.md': source }),
    'old name.md',
    'new.md'
  );
  expect(planChange(plan, 'ref.md').after).toBe(
    '---\nlocation: >2- # header\n  new.md\n---\n# R\n'
  );
});

test('unrepresentable plain flow scalars refuse the complete plan', () => {
  const workspace = moveWorkspace({
    'a.md': '# A\n',
    'ref.md': '---\nabout: [a.md]\n---\n# R\n',
  });
  expect(() => buildMovePlan(workspace, 'a.md', 'new, file.md')).toThrow(
    'cannot preserve every reference'
  );
});

test('literal blocks and both quoted styles retain their syntax around quote characters', () => {
  const source =
    '---\nabout: [\'a.md\', "a.md"]\nlocation: |- # keep\n  a.md\n---\n# Ref\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'a.md': '# A\n', 'ref.md': source }),
    'a.md',
    'd/\'quote".md'
  );
  const after = planChange(plan, 'ref.md').after;
  expect(after).toContain("'d/''quote\".md'");
  expect(after).toContain('"d/\'quote\\\".md"');
  expect(after).toContain('location: |- # keep\n  d/\'quote".md\n');
});
