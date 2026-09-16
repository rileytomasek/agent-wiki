import { expect, test } from 'vitest';

import { buildMovePlan } from '../src/moves/planning.ts';
import { moveWorkspace, planChange } from './fixtures/move.ts';

test.each([
  '#caf%C3%A9',
  '\\#caf%C3%A9',
  '&#35;caf%C3%A9',
  '&num;caf%C3%A9',
  '&#x23;caf%C3%A9',
])('authored fragment spelling %s is retained', (fragment) => {
  const source = `# Ref\n\n[Label](old.md${fragment})\n`;
  const plan = buildMovePlan(
    moveWorkspace({ 'old.md': '# Old\n\n## Café\n', 'ref.md': source }),
    'old.md',
    'new place.md'
  );
  expect(planChange(plan, 'ref.md').after).toBe(
    `# Ref\n\n[Label](new%20place.md${fragment})\n`
  );
});

test('encoded hash filenames are distinct from fragments and syntax is retained', () => {
  const source =
    '# Ref\r\n\r\n[x](<old%23name.md#part>) [y](old%23name.md#part)\r\n';
  const plan = buildMovePlan(
    moveWorkspace({ 'old#name.md': '# Old\n\n## Part\n', 'ref.md': source }),
    'old#name.md',
    'new/😀#(name).md'
  );
  expect(planChange(plan, 'ref.md').after).toBe(
    '# Ref\r\n\r\n[x](<new/%F0%9F%98%80%23%28name%29.md#part>) [y](new/%F0%9F%98%80%23%28name%29.md#part)\r\n'
  );
});

test('unresolved heading fragments and missing target paths retain their intended identity', () => {
  const plan = buildMovePlan(
    moveWorkspace({
      'old/a.md': '# A\n\n[Missing](../missing.md#still-missing)\n',
      'ref.md': '# R\n\n[No heading](old/a.md#absent)\n',
    }),
    'old/a.md',
    'new/deep/a.md'
  );
  expect(planChange(plan, 'old/a.md').after).toContain(
    '(../../missing.md#still-missing)'
  );
  expect(planChange(plan, 'ref.md').after).toContain('(new/deep/a.md#absent)');
});
