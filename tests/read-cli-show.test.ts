import { expect, test } from 'vitest';

import {
  guideSource,
  readCommand,
  readJson,
  readObject,
  readObjects,
  readString,
  writeReadCorpus,
} from './fixtures/read-cli.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test.each(['notes/a-old.md', 'Orchid Guide'])(
  'show returns the current document for path or alias: %s',
  async (target) => {
    await inWorkspace(async (fixture) => {
      await writeReadCorpus(fixture);
      const result = readCommand(fixture.root, [
        'show',
        target,
        '--json',
        '--root',
        fixture.root,
      ]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const data = readJson(result.stdout);
      expect(data['document']).toMatchObject({
        path: 'notes/a-old.md',
        title: 'Orchid Guide',
        review: { stale: true, deadline: '2001-01-01' },
      });
      expect(data['content']).toBe(guideSource);
      expect(data['complete']).toBe(true);
      expect(data['diagnostics']).toEqual([]);
    });
  }
);

test('show sections keeps heading context and appends each cited definition once', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      '--root',
      fixture.root,
      '--json',
      'show',
      'notes/a-old.md#details',
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    const content = readString(data['content']);
    expect(content).toContain('# Orchid Guide');
    expect(content).toContain('## Details');
    expect(content).toContain('### Deep');
    expect(content).toContain('[^support]: A qualified explanation');
    expect(content.split('[^support]:')).toHaveLength(2);
    expect(content).not.toContain('Introduction outside');
    expect(content).not.toContain('Appendix outside');
    expect(data['section']).toMatchObject({ anchor: 'details' });
    expect(readObjects(data['headingContext'])).toMatchObject([
      { anchor: 'orchid-guide' },
    ]);
    expect(readObjects(data['footnotes'])).toMatchObject([
      { identifier: 'support' },
    ]);
    expect(result.stderr).toBe('');
  });
});

test('literal percent escapes, spaces and Unicode in file identities survive the CLI', async () => {
  await inWorkspace(async (fixture) => {
    const path = 'notes/literal %20 #日本語.md';
    const source = '# Literal document\n\nCurrent body.\n';
    await fixture.write(path, source);
    const result = readCommand(fixture.root, [
      'show',
      path,
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(readObject(data['document'])['path']).toBe(path);
    expect(data['content']).toBe(source);
  });
});

test('ambiguous aliases report candidates instead of selecting one document', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const result = readCommand(fixture.root, [
      'show',
      'Shared Name',
      '--json',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(1);
    const data = readJson(result.stdout);
    expect(data['candidates']).toEqual(['notes/a-old.md', 'notes/b-old.md']);
    expect(readObjects(data['diagnostics'])).toMatchObject([
      { code: 'target-ambiguous' },
    ]);
    expect(data).not.toHaveProperty('document');
  });
});

test('a new source edit appears immediately without changing its review deadline', async () => {
  await inWorkspace(async (fixture) => {
    await writeReadCorpus(fixture);
    const args = ['show', 'notes/a-old.md', '--json', '--root', fixture.root];
    expect(readJson(readCommand(fixture.root, args).stdout)['content']).toBe(
      guideSource
    );
    const edited = guideSource.replace(
      'Introduction outside',
      'Revised introduction outside'
    );
    await fixture.write('notes/a-old.md', edited);
    const result = readCommand(fixture.root, args);
    expect(result.status).toBe(0);
    const data = readJson(result.stdout);
    expect(data['content']).toBe(edited);
    expect(readObject(data['document'])['review']).toMatchObject({
      stale: true,
      deadline: '2001-01-01',
    });
  });
});

test('text show keeps content on stdout and does not depend on QMD', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('readable.md', '# Readable\n\nPlain content.\n');
    const result = readCommand(fixture.root, [
      'show',
      'readable.md',
      '--root',
      fixture.root,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('# Readable\n\nPlain content.');
    expect(result.stderr).toBe('');
  });
});

test('an option-looking path is accepted after the argument terminator', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('--draft.md', '# Draft\n');
    const result = readCommand(fixture.root, [
      '--root',
      fixture.root,
      '--json',
      'show',
      '--',
      '--draft.md',
    ]);
    expect(result.status).toBe(0);
    expect(readObject(readJson(result.stdout)['document'])['path']).toBe(
      '--draft.md'
    );
  });
});
