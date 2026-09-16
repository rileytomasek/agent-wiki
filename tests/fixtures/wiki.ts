import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { Metadata } from '../../src/index.ts';

export async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-'));
  const mirrorPath = join(directory, 'mirror');
  await mkdir(mirrorPath);
  return {
    directory,
    paths: { dbPath: join(directory, 'index.sqlite'), mirrorPath },
    async write(
      path: string,
      metadata: Metadata = {},
      body = 'Orchid knowledge'
    ) {
      const target = join(mirrorPath, path);
      await mkdir(dirname(target), { recursive: true });
      const fields = { source_path: path, ...metadata };
      const content = `---\nqmd:\n  metadata: ${JSON.stringify(fields)}\n---\n# ${path}\n\n${body}\n`;
      await writeFile(target, content);
    },
    async remove(path: string) {
      await rm(join(mirrorPath, path));
    },
    async dispose() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
