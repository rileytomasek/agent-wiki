import type { WikiFrontmatter } from '../../src/documents/types.ts';
import type { WorkspaceFixture } from './workspace.ts';

export async function writeListDocument(
  fixture: WorkspaceFixture,
  path: string,
  metadata: WikiFrontmatter = {}
): Promise<void> {
  await fixture.write(
    path,
    `---\n${JSON.stringify(metadata)}\n---\n# ${path}\n\nReadable content.\n`
  );
}

export async function writeTypeCorpus(
  fixture: WorkspaceFixture
): Promise<void> {
  await writeListDocument(fixture, 'a/plain.md', {
    type: 'person',
    about: ['../subjects/main.md'],
  });
  await writeListDocument(fixture, 'b/deep.md', {
    type: 'entity/person/details',
    about: ['../subjects/main.md'],
  });
  await writeListDocument(fixture, 'c/base.md', {
    type: 'entity/person',
    about: ['../subjects/main.md'],
  });
  await writeListDocument(fixture, 'd/missing.md');
  await writeListDocument(fixture, 'subjects/main.md');
}
