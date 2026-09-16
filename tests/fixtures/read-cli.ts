import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { WorkspaceFixture } from './workspace.ts';

type JsonObject = Readonly<Record<string, unknown>>;

export function readCommand(cwd: string, args: readonly string[]) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      resolve('tests/fixtures/deny-qmd.ts'),
      resolve('src/cli/bin.ts'),
      ...args,
    ],
    { cwd, encoding: 'utf8', timeout: 10_000 }
  );
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readObject(value: unknown): JsonObject {
  if (!isObject(value)) throw new Error('Expected a JSON object');
  return value;
}

export function readJson(stdout: string): JsonObject {
  const value: unknown = JSON.parse(stdout);
  return readObject(value);
}

export function readObjects(value: unknown): readonly JsonObject[] {
  if (!Array.isArray(value)) throw new Error('Expected a JSON array');
  return value.map((item: unknown) => readObject(item));
}

export function readString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a JSON string');
  return value;
}

export function documentPaths(result: JsonObject): readonly string[] {
  return readObjects(result['documents']).map((document) =>
    readString(document['path'])
  );
}

export const guideSource = [
  '---',
  'type: doc/guide',
  'aliases: ["Orchid Guide", "Shared Name"]',
  'about: [../subjects/orchid.md]',
  'stale_after: 2001-01-01',
  '---',
  '# Orchid Guide',
  '',
  'Introduction outside the selected section.',
  '',
  '## Details',
  '',
  'Details have a qualified source[^support].',
  '',
  '### Deep',
  '',
  'Deep detail cites the same note[^support].',
  '',
  '## Appendix',
  '',
  'Appendix outside the selected section.',
  '',
  '[^support]: A qualified explanation with [context](../subjects/orchid.md).',
  '',
].join('\n');

const corpus = [
  ['subjects/orchid.md', '# Orchid\n'],
  ['subjects/other.md', '# Other\n'],
  ['notes/a-old.md', guideSource],
  [
    'notes/b-old.md',
    '---\ntype: doc/guide\naliases: ["Shared Name"]\nabout: [../subjects/orchid.md]\nstale_after: 2000-01-01\n---\n# Older Guide\n',
  ],
  [
    'notes/c-new.md',
    '---\ntype: doc/guide\nabout: [../subjects/orchid.md]\nstale_after: 2999-01-01\n---\n# Future Guide\n',
  ],
  [
    'notes/d-note.md',
    '---\ntype: doc/note\nabout: [../subjects/orchid.md]\nstale_after: 2005-01-01\n---\n# Note\n',
  ],
  [
    'notes/e-other.md',
    '---\ntype: doc/guide\nabout: [../subjects/other.md]\nstale_after: 2000-01-01\n---\n# Other Guide\n',
  ],
  [
    'notes/f-undated.md',
    '---\ntype: doc/guide\nabout: [../subjects/orchid.md]\n---\n# Undated Guide\n',
  ],
];

export async function writeReadCorpus(
  fixture: WorkspaceFixture
): Promise<void> {
  await Promise.all(
    corpus.map(async (entry) => {
      const [path, source] = entry;
      if (path === undefined || source === undefined)
        throw new Error('Invalid test corpus entry');
      await fixture.write(path, source);
    })
  );
}
