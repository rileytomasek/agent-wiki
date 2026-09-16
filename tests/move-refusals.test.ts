import { expect, test } from 'vitest';

import { buildMovePlan } from '../src/moves/planning.ts';
import { moveWorkspace } from './fixtures/move.ts';

test.each([
  '/outside.md',
  '../outside.md',
  '.hidden.md',
  '.agent-wiki/a.md',
  'vendor/a.md',
  'a.txt',
  'C:\\a.md',
])('unsafe or excluded destination %s is refused', (to) => {
  expect(() =>
    buildMovePlan(moveWorkspace({ 'a.md': '# A\n' }), 'a.md', to)
  ).toThrow('visible Markdown path');
});

test('same-path moves and occupied destinations are refused', () => {
  const workspace = moveWorkspace({ 'a.md': '# A\n', 'b.md': '# B\n' });
  expect(() => buildMovePlan(workspace, './a.md', 'dir/../a.md')).toThrow(
    'same path'
  );
  expect(() => buildMovePlan(workspace, 'a.md', 'b.md')).toThrow(
    'already exists'
  );
});

test('missing, section, attachment and ambiguous sources are refused', () => {
  const source = '---\naliases: [Shared]\n---\n# A\n\n## Part\n';
  const workspace = moveWorkspace({ 'a.md': source, 'b.md': source }, [
    'image.png',
  ]);
  expect(() => buildMovePlan(workspace, 'Shared', 'new.md')).toThrow(
    'ambiguous'
  );
  expect(() => buildMovePlan(workspace, 'a.md#part', 'new.md')).toThrow(
    'whole Markdown document'
  );
  expect(() => buildMovePlan(workspace, 'image.png', 'new.md')).toThrow(
    'whole Markdown document'
  );
  expect(() => buildMovePlan(workspace, 'missing.md', 'new.md')).toThrow(
    'not found'
  );
  expect(() =>
    buildMovePlan(workspace, 'https://example.com/a.md', 'new.md')
  ).toThrow('whole Markdown document');
});

test('incomplete inventories and uninterpretable reference sources refuse planning', () => {
  const workspace = moveWorkspace({ 'a.md': '# A\n' });
  expect(() =>
    buildMovePlan({ ...workspace, complete: false }, 'a.md', 'new.md')
  ).toThrow('complete current read');
  const malformed = moveWorkspace({
    'a.md': '# A\n',
    'bad.md': '---\nabout: [a.md\n---\n# Bad\n',
  });
  expect(() => buildMovePlan(malformed, 'a.md', 'new.md')).toThrow(
    'cannot be rewritten safely'
  );
  const anchored = moveWorkspace({
    'a.md': '# A\n',
    'ref.md': '---\nabout: [&target a.md, *target]\n---\n# Ref\n',
  });
  expect(() => buildMovePlan(anchored, 'a.md', 'new.md')).toThrow(
    'cannot be rewritten safely'
  );
});

test('invalid local outgoing destinations cannot acquire new meanings after moving', () => {
  const workspace = moveWorkspace({
    'a.md': '# A\n\n[Escape](../outside.md)\n',
  });
  expect(() => buildMovePlan(workspace, 'a.md', 'deep/new.md')).toThrow(
    'Cannot safely rebase'
  );
  const unrelated = moveWorkspace({
    'a.md': '# A\n',
    'b.md': '# B\n\n[Escape](../outside.md)\n',
  });
  expect(buildMovePlan(unrelated, 'a.md', 'new.md').changes).toHaveLength(1);
});
