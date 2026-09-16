import { cp, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { inWorkspace } from './workspace.ts';
import type { WorkspaceFixture } from './workspace.ts';

export async function inExampleWiki(
  run: (fixture: WorkspaceFixture) => Promise<void>
): Promise<void> {
  await inWorkspace(async (fixture) => {
    await cp(resolve('examples/wiki'), fixture.root, { recursive: true });
    await run(fixture);
  });
}

/** Compare authored bytes while excluding replaceable derived data. */
export async function exampleSources(
  root: string
): Promise<Readonly<Record<string, string>>> {
  const paths = (await readdir(root, { recursive: true }))
    .filter((path) => path.endsWith('.md') && !path.startsWith('.agent-wiki/'))
    .toSorted();
  const entries = await Promise.all(
    paths.map(
      async (path): Promise<readonly [string, string]> => [
        path,
        await readFile(join(root, path), 'utf8'),
      ]
    )
  );
  return Object.fromEntries(entries);
}
