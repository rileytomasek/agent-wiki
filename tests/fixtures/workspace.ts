import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface WorkspaceFixture {
  readonly root: string;
  readonly write: (path: string, source?: string) => Promise<void>;
  readonly directory: (path: string) => Promise<void>;
}

export function cachePath(root: string): string {
  return join(root, '.agent-wiki', 'cache', 'documents.json');
}

export async function inWorkspace(
  run: (fixture: WorkspaceFixture) => void | Promise<void>
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'wiki-workspace-'));
  try {
    await run({
      root,
      async write(path, source = '# Title\n') {
        const absolute = join(root, path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, source);
      },
      async directory(path) {
        await mkdir(join(root, path), { recursive: true });
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
