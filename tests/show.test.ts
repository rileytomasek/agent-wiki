import { expect, test, vi } from 'vitest';

import type { Clock } from '../src/documents/dates.ts';
import { showDocument } from '../src/operations/show.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('full document display retains every authored byte and unrelated diagnostics', async () => {
  await inWorkspace(async (fixture) => {
    const source =
      '---\r\naliases: [Other]\r\nunknown: value\r\n---\r\n## Readable\r\n\r\nBody.\r\n';
    await fixture.write('document.md', source);
    const shown = await showDocument(fixture.root, 'document.md');
    expect(shown.content).toBe(source);
    expect(shown.document).toMatchObject({
      path: 'document.md',
      title: 'document.md',
      metadata: { aliases: ['Other'] },
      review: { stale: false },
    });
    expect(shown.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'frontmatter-unknown',
      'markdown-title-count',
    ]);
    expect(shown.headingContext).toEqual([]);
    expect(shown.section).toBeUndefined();
    expect(shown.complete).toBe(true);
  });
});

test('a direct path read needs no workspace inventory or search initialization', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('nested/doc.md', '# Current\n');
    await fixture.write('.agent-wiki/cache/qmd.sqlite', 'broken search state');
    const scan = vi
      .spyOn(filesystemIO, 'readDirectory')
      .mockRejectedValue(new Error('No inventory allowed'));
    try {
      expect((await showDocument(fixture.root, 'nested/doc.md')).content).toBe(
        '# Current\n'
      );
      expect(scan).not.toHaveBeenCalled();
    } finally {
      scan.mockRestore();
    }
  });
});

test('section display keeps ancestor headings, exact CRLF and referenced external definitions once', async () => {
  await inWorkspace(async (fixture) => {
    const source = [
      '# Top',
      '',
      'Excluded introduction.',
      '',
      '## Parent',
      '',
      'Excluded parent text.',
      '',
      '### Selected',
      '',
      'A[^one], B[^one].',
      '',
      '### Sibling',
      '',
      'Excluded sibling.',
      '',
      '## Notes',
      '',
      '[^one]: Qualified [source](a.md). Also[^two].',
      '',
      '[^two]: Nested definition.',
      '',
      '[^unused]: Unused definition.',
      '',
    ].join('\r\n');
    await fixture.write('document.md', source);
    const shown = await showDocument(fixture.root, 'document.md#selected');
    expect(shown.content).toBe(
      '# Top\r\n\r\n## Parent\r\n\r\n### Selected\r\n\r\nA[^one], B[^one].\r\n\r\n[^one]: Qualified [source](a.md). Also[^two].\r\n\r\n[^two]: Nested definition.'
    );
    expect(shown.headingContext.map((section) => section.anchor)).toEqual([
      'top',
      'parent',
    ]);
    expect(shown.section?.anchor).toBe('selected');
    expect(shown.footnotes.map((note) => note.identifier)).toEqual([
      'one',
      'two',
    ]);
    expect(shown.diagnostics).toEqual([]);
  });
});

test('footnote definitions already inside the selected section are not duplicated', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'doc.md',
      '# T\n\n## Part\n\nClaim[^n].\n\n[^n]: Existing definition.\n'
    );
    const shown = await showDocument(fixture.root, 'doc.md#part');
    expect(shown.content.match(/\[\^n\]:/gu)).toHaveLength(1);
    expect(shown.footnotes.map((note) => note.identifier)).toEqual(['n']);
  });
});

test('cyclic and unresolved footnotes terminate while retaining useful section content', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'doc.md',
      '# T\n\n## Part\n\nClaim[^a] and missing[^none].\n\n## Notes\n\n[^a]: See[^b].\n\n[^b]: See[^a].\n'
    );
    const shown = await showDocument(fixture.root, 'doc.md#part');
    expect(shown.content.match(/\[\^a\]:/gu)).toHaveLength(1);
    expect(shown.content.match(/\[\^b\]:/gu)).toHaveLength(1);
    expect(shown.footnotes.map((note) => note.identifier)).toEqual([
      'a',
      'none',
      'b',
    ]);
    expect(shown.diagnostics[0]?.code).toBe('markdown-footnote-missing');
    expect(shown.complete).toBe(true);
  });
});

test('show reads current edits and captures its review date once before asynchronous work', async () => {
  await inWorkspace(async (fixture) => {
    const clock = vi
      .fn<Clock>()
      .mockReturnValueOnce(new Date(2026, 8, 16, 23, 59))
      .mockReturnValue(new Date(2026, 8, 17));
    await fixture.write(
      'doc.md',
      '---\nstale_after: 2026-09-17\n---\n# Before\n'
    );
    const first = await showDocument(fixture.root, 'doc.md', { clock });
    expect(first.document.review).toEqual({
      stale: false,
      deadline: '2026-09-17',
      daysOverdue: 0,
    });
    expect(clock).toHaveBeenCalledTimes(1);
    await fixture.write(
      'doc.md',
      '---\nstale_after: 2026-09-17\n---\n# After\n'
    );
    const second = await showDocument(fixture.root, 'doc.md', { clock });
    expect(second.content).toContain('# After');
    expect(second.document.review).toEqual({
      stale: true,
      deadline: '2026-09-17',
      daysOverdue: 0,
    });
    expect(clock).toHaveBeenCalledTimes(2);
  });
});

test('a footnote nested in another appended definition appears exactly once', async () => {
  await inWorkspace(async (fixture) => {
    const source =
      '# T\n\n## Part\n\nClaim[^a].\n\n## End\n\n[^a]: Outer[^b].\n\n    [^b]: Inner [link](target.md).\n';
    await fixture.write('doc.md', source);
    const shown = await showDocument(fixture.root, 'doc.md#part');
    expect(shown.content).toBe(
      '# T\n\n## Part\n\nClaim[^a].\n\n[^a]: Outer[^b].\n\n    [^b]: Inner [link](target.md).'
    );
    expect(shown.content.match(/\[\^b\]:/gu)).toHaveLength(1);
    expect(shown.footnotes.map((note) => note.identifier)).toEqual(['a', 'b']);
  });
});
