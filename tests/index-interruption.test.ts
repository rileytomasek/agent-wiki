import { readFile, realpath, unlink } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { indexStatus, indexWiki } from '../src/index.ts';
import { deferEmbeddings, indexedHits } from './fixtures/index.ts';
import { interruptAfterText } from './fixtures/interrupted-index.ts';
import { readCommand, readJson } from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('a terminated writer leaves searchable text and an honest checkpoint until its abandoned lock is removed', async () => {
  await inWorkspace(async (fixture) => {
    const source =
      '# Recovery\n\nOrchid snapshot survives an interrupted writer.\n';
    await fixture.write('recovery.md', source);
    const child = await interruptAfterText(fixture.root);
    expect(child.signal).toBe('SIGTERM');
    const lockPath = join(fixture.root, '.agent-wiki/cache/write.lock');
    const owner = await readFile(lockPath, 'utf8');
    expect(readJson(owner)).toMatchObject({ pid: child.pid, host: hostname() });
    const interrupted = await indexStatus(fixture.root);
    expect(interrupted).toMatchObject({
      status: 'incomplete',
      currency: 'current',
      indexComplete: false,
      run: { stage: 'embed' },
      pendingEmbeddings: 1,
      lastCompletedAt: null,
    });
    expect(interrupted.lastTextUpdate).not.toBeNull();
    const inspected = readCommand(fixture.root, ['status', '--json']);
    expect(inspected.status).toBe(0);
    expect(inspected.stderr).toBe('');
    expect(readJson(inspected.stdout)).toEqual({
      ...interrupted,
      root: await realpath(fixture.root),
    });
    expect(
      (await indexedHits(fixture.root, 'orchid')).map((hit) => hit.path)
    ).toEqual(['recovery.md']);
    await expect(
      indexWiki(fixture.root, { embed: deferEmbeddings })
    ).rejects.toMatchObject({ code: 'workspace.locked' });
    expect(await readFile(lockPath, 'utf8')).toBe(owner);
    await unlink(lockPath);
    const retried = await indexWiki(fixture.root, { embed: deferEmbeddings });
    expect(retried.update).toMatchObject({ unchanged: 1 });
    expect(retried.complete).toBe(false);
    expect(retried.state.run.stage).toBe('failed');
    expect(retried.state.qmd?.needsEmbedding).toBe(1);
    await expect(readFile(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(fixture.root, 'recovery.md'), 'utf8')).toBe(
      source
    );
    expect(
      (await indexedHits(fixture.root, 'orchid')).map((hit) => hit.path)
    ).toEqual(['recovery.md']);
  });
});
