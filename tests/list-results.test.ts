import { expect, test, vi } from 'vitest';

import { listDocuments } from '../src/operations/list.ts';
import { refreshWorkspace } from '../src/workspace/snapshots.ts';
import { failSource } from './fixtures/workspace-io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('usable metadata survives structural errors while empty filtered results remain successful', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'invalid.md',
      '---\ntype: doc/note\ncustom: unknown\n---\nReadable without a title.\n'
    );
    await fixture.write('.agent-wiki/cache/qmd.sqlite', 'broken search state');
    const listed = await listDocuments(fixture.root, {
      filters: { type: 'doc/note' },
    });
    expect(listed.documents).toMatchObject([
      { path: 'invalid.md', metadata: { type: 'doc/note' } },
    ]);
    expect(listed.complete).toBe(true);
    expect(listed.diagnostics).toHaveLength(2);
    const empty = await listDocuments(fixture.root, {
      filters: { type: 'entity/person' },
    });
    expect(empty).toEqual({
      documents: [],
      total: 0,
      truncated: false,
      complete: true,
      diagnostics: [],
    });
  });
});

test('incomplete source coverage returns useful results with operational diagnostics', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('good.md');
    await fixture.write('unreadable.md');
    const partial = await refreshWorkspace(fixture.root, {
      io: failSource('/unreadable.md'),
    });
    const module = await import('../src/workspace/snapshots.ts');
    const refresh = vi
      .spyOn(module, 'refreshWorkspace')
      .mockResolvedValue(partial);
    try {
      const result = await listDocuments(fixture.root);
      expect(result.documents).toMatchObject([{ path: 'good.md' }]);
      expect(result).toMatchObject({
        total: 1,
        truncated: false,
        complete: false,
      });
      expect(result.diagnostics).toMatchObject([
        { path: 'unreadable.md', code: 'workspace.read' },
      ]);
    } finally {
      refresh.mockRestore();
    }
  });
});
