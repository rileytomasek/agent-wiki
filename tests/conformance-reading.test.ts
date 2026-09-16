import { expect, test } from 'vitest';

import {
  listDocuments,
  related,
  showDocument,
  validate,
} from '../src/index.ts';
import { exampleSources, inExampleWiki } from './fixtures/example-wiki.ts';
import { readCommand, readJson, readObjects } from './fixtures/read-cli.ts';

test('example wiki inspection preserves section citations and exact filters through public API and executable', async () => {
  await inExampleWiki(async (fixture) => {
    const before = await exampleSources(fixture.root);
    const shown = await showDocument(fixture.root, 'Website project#delivery');
    expect(shown.section?.anchor).toBe('delivery');
    expect(shown.content).toContain('# Website');
    expect(shown.content).toContain('## Delivery');
    expect(shown.content).toContain('[^rollout]:');
    expect(shown.content).toContain('This fictional URL illustrates');
    const displayed = readCommand(fixture.root, [
      '--json',
      'show',
      'Website project#delivery',
    ]);
    expect(displayed.status).toBe(0);
    expect(displayed.stderr).toBe('');
    expect(readJson(displayed.stdout)['content']).toBe(shown.content);
    const filters = {
      type: 'doc/guide',
      category: 'doc',
      name: 'guide',
      about: 'projects/website.md',
      path: 'guides/**/*.md',
    };
    const listed = await listDocuments(fixture.root, { filters, limit: 1 });
    expect(listed.documents.map((document) => document.path)).toEqual([
      'guides/deployment.md',
    ]);
    const listing = readCommand(fixture.root, [
      'list',
      '--type',
      filters.type,
      '--category',
      filters.category,
      '--name',
      filters.name,
      '--about',
      filters.about,
      '--path',
      filters.path,
      '--limit',
      '1',
      '--json',
    ]);
    expect(listing.status).toBe(0);
    expect(listing.stderr).toBe('');
    expect(readJson(listing.stdout)).toMatchObject({
      total: 1,
      truncated: false,
    });
    expect(readObjects(readJson(listing.stdout)['documents'])).toMatchObject([
      { path: 'guides/deployment.md', metadata: { type: 'doc/guide' } },
    ]);
    expect(await exampleSources(fixture.root)).toEqual(before);
  });
});

test('example wiki relationships and selected validation share complete current context', async () => {
  await inExampleWiki(async (fixture) => {
    const target = 'https://github.com/example/website/pull/42';
    const relationships = await related(fixture.root, target);
    expect(relationships.total).toBe(2);
    expect(
      relationships.relationships.map(({ occurrence }) => occurrence.sourcePath)
    ).toEqual(['guides/deployment.md', 'projects/website.md']);
    const neighborhood = readCommand(fixture.root, [
      'related',
      target,
      '--json',
    ]);
    expect(neighborhood.status).toBe(0);
    expect(neighborhood.stderr).toBe('');
    expect(readJson(neighborhood.stdout)).toEqual(relationships);
    const whole = await validate(fixture.root);
    expect(whole).toMatchObject({
      valid: true,
      complete: true,
      diagnostics: [],
    });
    expect(whole.selectedPaths).toHaveLength(7);
    const validated = readCommand(fixture.root, ['validate', '--json']);
    expect(validated.status).toBe(0);
    expect(validated.stderr).toBe('');
    expect(readJson(validated.stdout)).toEqual(whole);
    const selected = await validate(fixture.root, ['guides/**/*.md']);
    expect(selected).toMatchObject({
      selectedPaths: ['guides/deployment.md'],
      valid: true,
      diagnostics: [],
    });
    const subset = readCommand(fixture.root, [
      'validate',
      'guides/**/*.md',
      '--json',
    ]);
    expect(subset.status).toBe(0);
    expect(readJson(subset.stdout)).toEqual(selected);
  });
});

test('a malformed addition remains readable and does not invalidate an unrelated selected scope', async () => {
  await inExampleWiki(async (fixture) => {
    const source =
      '---\nunknown: value\nemail: invalid\nstale_after: 2000-01-01\n---\n# Draft\n\nReadable draft[^missing].\n';
    await fixture.write('draft.md', source);
    const show = readCommand(fixture.root, ['show', 'draft.md', '--json']);
    expect(show.status).toBe(0);
    expect(readJson(show.stdout)['content']).toBe(source);
    expect(
      readObjects(readJson(show.stdout)['diagnostics']).length
    ).toBeGreaterThan(0);
    expect((await showDocument(fixture.root, 'draft.md')).content).toBe(source);
    const queue = readCommand(fixture.root, [
      'list',
      '--stale',
      '--path',
      'draft.md',
      '--json',
    ]);
    expect(queue.status).toBe(0);
    expect(readObjects(readJson(queue.stdout)['documents'])).toMatchObject([
      { path: 'draft.md', review: { stale: true, deadline: '2000-01-01' } },
    ]);
    await fixture.write(
      'draft.md',
      `${source}\nAn edit does not review the document.\n`
    );
    const current = await showDocument(fixture.root, 'draft.md');
    expect(current.document.review.deadline).toBe('2000-01-01');
    expect(current.document.review.stale).toBe(true);
    expect((await validate(fixture.root, ['guides'])).valid).toBe(true);
    const invalid = readCommand(fixture.root, ['validate', '--json']);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toBe('');
    expect(readJson(invalid.stdout)).toMatchObject({
      valid: false,
      complete: true,
    });
    expect((await validate(fixture.root)).valid).toBe(false);
  });
});
