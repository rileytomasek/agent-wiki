import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { readFiles } from '../src/workspace/read-files.ts';

export const benchmarkDocuments = 1000;

function source(index: number): string {
  const next = (index + 1) % benchmarkDocuments;
  const group = Math.floor(index / 100);
  const target = `../group-${Math.floor(next / 100)}/note-${next}.md`;
  const metadata = index % 25 === 0 ? 'unexpected: diagnostic fixture\n' : '';
  const paragraph =
    'Orchid cultivation needs careful watering, indirect daylight, and warm roots. ' +
    'These practical observations describe a small indoor garden through winter.\n';
  return [
    `---\ntype: doc/guide\nabout: [${target}]\nstale_after: 2026-01-01\n${metadata}---`,
    `# Garden note ${index}`,
    `A related [document](${target}#care) and a qualified citation[^source].`,
    '## Care',
    ...Array.from({ length: 24 }, () => paragraph),
    '## Sources',
    `[^source]: Local record from group ${group}: [details](${target}).`,
    '',
  ].join('\n\n');
}

/** Deterministic ~4 KB documents; 4% contain usable malformed metadata. */
export async function writeBenchmarkCorpus(root: string): Promise<number> {
  await mkdir(join(root, '.agent-wiki/cache'), { recursive: true });
  await Promise.all(
    Array.from({ length: 10 }, (_, group) =>
      mkdir(join(root, `group-${group}`))
    )
  );
  const paths = Array.from({ length: benchmarkDocuments }, (_, index) =>
    String(index)
  );
  const sizes = await readFiles(paths, async (path) => {
    const index = Number(path);
    const text = source(index);
    await writeFile(
      join(root, `group-${Math.floor(index / 100)}`, `note-${index}.md`),
      text
    );
    return Buffer.byteLength(text);
  });
  return sizes.reduce((total, size) => total + size, 0);
}
