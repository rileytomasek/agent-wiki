import { readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { showDocument } from '../src/operations/show.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('declared aliases select documents and sections with ambiguity candidates', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'z.md',
      '---\naliases: [Shared, Unique]\n---\n# Z\n\n## Detail\n\nChosen.\n'
    );
    await fixture.write('a.md', '---\naliases: [Shared]\n---\n# A\n');
    expect((await showDocument(fixture.root, 'Unique')).document.path).toBe(
      'z.md'
    );
    expect(
      (await showDocument(fixture.root, 'Unique#detail')).section?.anchor
    ).toBe('detail');
    await expect(showDocument(fixture.root, 'Shared')).rejects.toMatchObject({
      code: 'target-ambiguous',
      candidates: ['a.md', 'z.md'],
    });
  });
});

test('basenames and titles never become undeclared aliases', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a/doc.md', '# Display name\n');
    await fixture.write('b/doc.md', '# Display name\n');
    await expect(showDocument(fixture.root, 'doc.md')).rejects.toMatchObject({
      code: 'target-missing',
    });
    await expect(
      showDocument(fixture.root, 'Display name')
    ).rejects.toMatchObject({ code: 'target-missing' });
  });
});

test('literal paths win over aliases and preserve hash and percent filename characters', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a#b.md', '# Hash\n\n## Detail\n\nChosen.\n');
    await fixture.write('a%20b.md', '# Percent\n');
    await fixture.write('a b.md', '# Space\n');
    await fixture.write('other.md', '---\naliases: [a#b.md]\n---\n# Alias\n');
    expect((await showDocument(fixture.root, 'a#b.md')).document.title).toBe(
      'Hash'
    );
    expect(
      (await showDocument(fixture.root, 'a#b.md#detail')).section?.anchor
    ).toBe('detail');
    expect((await showDocument(fixture.root, 'a%20b.md')).document.title).toBe(
      'Percent'
    );
  });
});

test('full literal aliases containing hashes win before interpreting alias anchors', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'doc.md',
      '---\naliases: [Full, Full#detail]\n---\n# T\n\n## Detail\n\nChosen.\n'
    );
    const shown = await showDocument(fixture.root, 'Full#detail');
    expect(shown.section).toBeUndefined();
    expect(shown.content).toContain('aliases: [Full, Full#detail]');
  });
});

test('anchors decode once and report missing or invalid selectors', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('doc.md', '# T\n\n## Café\n\n## Café\n');
    expect(
      (await showDocument(fixture.root, 'doc.md#caf%C3%A9-1')).section?.anchor
    ).toBe('café-1');
    expect(
      (await showDocument(fixture.root, 'doc.md#')).section
    ).toBeUndefined();
    await expect(
      showDocument(fixture.root, 'doc.md#absent')
    ).rejects.toMatchObject({ code: 'target-anchor-missing' });
    await expect(
      showDocument(fixture.root, 'doc.md#%invalid')
    ).rejects.toMatchObject({ code: 'target-anchor-invalid' });
  });
});

test('alias lookup refuses apparently unique matches when inventory coverage is incomplete', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('known.md', '---\naliases: [Name]\n---\n# Known\n');
    await fixture.write('unreadable.md', '# Unreadable\n');
    const reader = vi
      .spyOn(filesystemIO, 'readSource')
      .mockImplementation(readWithFailure);
    try {
      await expect(showDocument(fixture.root, 'Name')).rejects.toMatchObject({
        code: 'workspace-incomplete',
      });
    } finally {
      reader.mockRestore();
    }
  });
});

function readWithFailure(path: string): Promise<string> {
  if (path.endsWith('unreadable.md'))
    return Promise.reject(new Error('Cannot read file'));
  return readFile(path, 'utf8');
}

test('unsafe paths, unreadable direct targets and directory symlinks are operational failures', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('real/doc.md');
    await symlink(join(fixture.root, 'real'), join(fixture.root, 'linked'));
    await fixture.directory('directory.md');
    await expect(
      showDocument(fixture.root, '../outside.md')
    ).rejects.toMatchObject({ code: 'target-unsafe' });
    await expect(
      showDocument(fixture.root, '/absolute.md')
    ).rejects.toMatchObject({ code: 'target-unsafe' });
    await expect(
      showDocument(fixture.root, 'linked/doc.md')
    ).rejects.toMatchObject({ code: 'target-read' });
    await expect(
      showDocument(fixture.root, 'directory.md')
    ).rejects.toMatchObject({ code: 'target-read' });
    await expect(showDocument(fixture.root, '')).rejects.toMatchObject({
      code: 'target-empty',
    });
  });
});

test('path-shaped aliases resolve exactly without permitting excluded or outside-root reads', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'person.md',
      '---\naliases: [/Alex, ../Alex, .hidden.md, .agent-wiki/cache/secret.md]\n---\n# Alex\n'
    );
    await fixture.write('.hidden.md', '# Hidden actual file\n');
    await fixture.write('.agent-wiki/cache/secret.md', '# Cache actual file\n');
    expect((await showDocument(fixture.root, '/Alex')).document.path).toBe(
      'person.md'
    );
    expect((await showDocument(fixture.root, '../Alex')).document.path).toBe(
      'person.md'
    );
    expect((await showDocument(fixture.root, '.hidden.md')).document.path).toBe(
      'person.md'
    );
    expect(
      (await showDocument(fixture.root, '.agent-wiki/cache/secret.md')).document
        .path
    ).toBe('person.md');
    await expect(
      showDocument(fixture.root, '.hidden-absent.md')
    ).rejects.toMatchObject({ code: 'target-excluded' });
    await expect(
      showDocument(fixture.root, '../absent.md')
    ).rejects.toMatchObject({ code: 'target-unsafe' });
  });
});
