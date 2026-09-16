import { expect, test } from 'vitest';

import { refreshWorkspace } from '../src/workspace/snapshots.ts';
import { trackReads } from './fixtures/workspace-tracking.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('large inventories bound open reads and retain all documents in path order', async () => {
  await inWorkspace(async (fixture) => {
    const paths = Array.from(
      { length: 96 },
      (_, index) => `directory-${index % 32}/document-${index}.md`
    );
    await Promise.all(paths.map((path) => fixture.write(path)));
    const reads = trackReads();
    const workspace = await refreshWorkspace(fixture.root, { io: reads.io });
    expect(workspace.complete).toBe(true);
    expect(
      workspace.documents.map((snapshot) => snapshot.document.path)
    ).toEqual(paths.toSorted());
    expect(reads.sourcePeak()).toBeGreaterThan(1);
    expect(reads.sourcePeak()).toBeLessThanOrEqual(16);
    expect(reads.directoryPeak()).toBe(1);
  });
});
