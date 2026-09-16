import { expect, test, vi } from 'vitest';

import type { Clock } from '../src/documents/dates.ts';
import { listDocuments } from '../src/operations/list.ts';
import { writeListDocument } from './fixtures/list-corpus.ts';
import { inWorkspace } from './fixtures/workspace.ts';

const clock = () => new Date(2026, 8, 16, 12);

test('stale list includes deadlines today and earlier, ordered by oldest deadline then path', async () => {
  await inWorkspace(async (fixture) => {
    await writeListDocument(fixture, 'z-old.md', { stale_after: '2026-09-10' });
    await writeListDocument(fixture, 'B-tie.md', { stale_after: '2026-09-15' });
    await writeListDocument(fixture, 'a-tie.md', { stale_after: '2026-09-15' });
    await writeListDocument(fixture, 'today.md', { stale_after: '2026-09-16' });
    await writeListDocument(fixture, 'future.md', {
      stale_after: '2026-09-17',
    });
    await writeListDocument(fixture, 'undated.md');
    const due = await listDocuments(fixture.root, {
      filters: { stale: true },
      clock,
    });
    expect(due.documents.map((document) => document.path)).toEqual([
      'z-old.md',
      'B-tie.md',
      'a-tie.md',
      'today.md',
    ]);
    expect(due.documents.map((document) => document.review)).toEqual([
      { deadline: '2026-09-10', daysOverdue: 6, stale: true },
      { deadline: '2026-09-15', daysOverdue: 1, stale: true },
      { deadline: '2026-09-15', daysOverdue: 1, stale: true },
      { deadline: '2026-09-16', daysOverdue: 0, stale: true },
    ]);
    expect(due).toMatchObject({
      total: 4,
      truncated: false,
      diagnostics: [],
      complete: true,
    });
  });
});

test('ordinary listing retains due, future and undated documents and edits do not reset deadlines', async () => {
  await inWorkspace(async (fixture) => {
    await writeListDocument(fixture, 'past.md', { stale_after: '2026-09-15' });
    await writeListDocument(fixture, 'future.md', {
      stale_after: '2026-09-17',
    });
    await writeListDocument(fixture, 'undated.md');
    const first = await listDocuments(fixture.root, { clock });
    expect(first.documents.map((document) => document.path)).toEqual([
      'future.md',
      'past.md',
      'undated.md',
    ]);
    expect(first.documents.map((document) => document.review)).toEqual([
      { deadline: '2026-09-17', daysOverdue: 0, stale: false },
      { deadline: '2026-09-15', daysOverdue: 1, stale: true },
      { stale: false },
    ]);
    await fixture.write(
      'past.md',
      '---\nstale_after: 2026-09-15\n---\n# Edited content\n'
    );
    const second = await listDocuments(fixture.root, {
      filters: { stale: true },
      clock,
    });
    expect(second.documents).toMatchObject([
      { title: 'Edited content', review: { stale: true, daysOverdue: 1 } },
    ]);
  });
});

test('one invocation date remains stable when the clock crosses local midnight', async () => {
  await inWorkspace(async (fixture) => {
    await writeListDocument(fixture, 'today.md', { stale_after: '2026-09-16' });
    await writeListDocument(fixture, 'tomorrow.md', {
      stale_after: '2026-09-17',
    });
    const crossing = vi
      .fn<Clock>()
      .mockReturnValueOnce(new Date(2026, 8, 16, 23, 59))
      .mockReturnValue(new Date(2026, 8, 17, 0, 1));
    const documents = await listDocuments(fixture.root, {
      filters: { stale: true },
      clock: crossing,
    });
    expect(documents.documents.map((document) => document.path)).toEqual([
      'today.md',
    ]);
    expect(crossing).toHaveBeenCalledTimes(1);
  });
});
