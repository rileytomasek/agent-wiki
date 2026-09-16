import { readFile } from 'node:fs/promises';

import { expect, test, vi } from 'vitest';

import { related } from '../src/operations/related.ts';
import { validate } from '../src/operations/validate.ts';
import { filesystemIO } from '../src/workspace/io.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('selected validation resolves unselected targets and limits structural diagnostics to its selection', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'selected/source.md',
      '# Source\n\n[target](../target.md#part)\n'
    );
    await fixture.write('target.md', '# Target\n\n## Part\n');
    await fixture.write(
      'unselected-bad.md',
      'No H1 and [missing](absent.md).\n'
    );
    expect(await validate(fixture.root, ['selected/source.md'])).toEqual({
      selectedPaths: ['selected/source.md'],
      diagnostics: [],
      complete: true,
      valid: true,
    });
    const whole = await validate(fixture.root);
    expect(whole.valid).toBe(false);
    expect(whole.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      'unselected-bad.md',
      'unselected-bad.md',
    ]);
  });
});

test('literal files, directories, glob selections and overlaps deduplicate deterministically', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('docs/one.md');
    await fixture.write('docs/sub/two.md');
    await fixture.write('literal[0].md');
    await fixture.write('outside.md');
    const selected = await validate(fixture.root, [
      'docs/',
      'docs/**/*.md',
      'docs/one.md',
      'literal[0].md',
    ]);
    expect(selected.selectedPaths).toEqual([
      'docs/one.md',
      'docs/sub/two.md',
      'literal[0].md',
    ]);
    expect(selected.valid).toBe(true);
    await expect(
      validate(fixture.root, ['docs', 'unmatched/**/*.md'])
    ).rejects.toMatchObject({ code: 'selection-unmatched' });
    await expect(
      validate(fixture.root, ['../outside.md'])
    ).rejects.toMatchObject({ code: 'selection-invalid' });
  });
});

test('valid YAML anchors and aliases resolve despite being unsuitable for exact move edits', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'source.md',
      '---\nabout: [&person person.md]\nauthors: [*person]\n---\n# Source\n'
    );
    await fixture.write('person.md', '# Person\n');
    expect(await validate(fixture.root)).toMatchObject({
      complete: true,
      valid: true,
      diagnostics: [],
    });
    const relationships = await related(fixture.root, 'person.md');
    expect(relationships).toMatchObject({
      complete: true,
      total: 2,
      diagnostics: [],
    });
    expect(
      relationships.relationships.map(
        ({ occurrence }) => occurrence.reference.destinationSpan
      )
    ).toEqual([undefined, undefined]);
  });
});

test('read failures never substitute an older cache record or claim complete selected validation', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.directory('.agent-wiki');
    await fixture.write('source.md', '# Source\n\n[target](unreadable.md)\n');
    await fixture.write('unreadable.md', '# Existing\n');
    expect((await validate(fixture.root)).valid).toBe(true);
    const read = vi
      .spyOn(filesystemIO, 'readSource')
      .mockImplementation(readWithFailure);
    try {
      const validation = await validate(fixture.root, ['source.md']);
      expect(validation).toMatchObject({
        complete: false,
        valid: false,
        selectedPaths: ['source.md'],
      });
      expect(
        validation.diagnostics.map((diagnostic) => diagnostic.code)
      ).toEqual(['workspace.read', 'reference-unavailable-target']);
      const neighborhood = await related(fixture.root, 'source.md');
      expect(neighborhood.complete).toBe(false);
      expect(neighborhood.relationships[0]?.occurrence.resolution).toEqual({
        status: 'unresolved',
        reason: 'unavailable-target',
        path: 'unreadable.md',
      });
    } finally {
      read.mockRestore();
    }
  });
});

function readWithFailure(path: string): Promise<string> {
  if (path.endsWith('unreadable.md'))
    return Promise.reject(new Error('Source temporarily unreadable'));
  return readFile(path, 'utf8');
}
