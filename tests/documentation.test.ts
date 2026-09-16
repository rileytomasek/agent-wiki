import { readFile, readdir, stat } from 'node:fs/promises';

import { expect, test } from 'vitest';

import { parseDocument } from '../src/documents/parse.ts';
import { normalizeReferencePath } from '../src/documents/paths.ts';
import { hashSource } from '../src/workspace/snapshots.ts';

async function markdownFiles(directory: string): Promise<readonly string[]> {
  return (await readdir(directory, { recursive: true }))
    .filter((path) => path.endsWith('.md'))
    .map((path) => `${directory}/${path}`);
}

async function parsed(path: string) {
  const source = await readFile(path, 'utf8');
  return parseDocument({ path, source, sourceHash: hashSource(source) });
}

async function verifyLink(path: string, destination: string): Promise<void> {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(destination)) return;
  const target = normalizeReferencePath(path, destination);
  if (target === undefined)
    throw new Error(`${path}: invalid local link ${destination}`);
  const entry = await stat(target.path);
  expect(entry.isFile() || entry.isDirectory(), `${path}: ${destination}`).toBe(
    true
  );
  if (target.fragment === undefined || !target.path.endsWith('.md')) return;
  const document = await parsed(target.path);
  expect(
    document.sections.map((section) => section.anchor),
    `${path}: ${destination}`
  ).toContain(target.fragment);
}

test('repository, contributor and author guides have valid local links and heading anchors', async () => {
  const paths = [
    'README.md',
    'AGENTS.md',
    'CONTRIBUTING.md',
    ...(await markdownFiles('docs')),
    ...(await markdownFiles('examples')),
  ];
  const documents = await Promise.all(paths.map((path) => parsed(path)));
  const links = documents.flatMap((document) =>
    document.references.map((reference) =>
      verifyLink(document.path, reference.destination)
    )
  );
  await Promise.all(links);
  expect(documents.length).toBeGreaterThan(20);
});
