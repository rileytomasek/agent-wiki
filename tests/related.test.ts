import { expect, test } from 'vitest';

import { related } from '../src/operations/related.ts';
import { inWorkspace } from './fixtures/workspace.ts';

test('related aggregates section destinations, counts self-links once, and limits actual relationships', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'a.md',
      '# A\n\n[document](b.md) [section](b.md#part)\n'
    );
    await fixture.write(
      'b.md',
      '# B\n\n## Part\n\n[self](#part) [external](https://example.com/work)\n'
    );
    await fixture.write('unrelated.md', 'No title here.\n');
    const whole = await related(fixture.root, 'b.md');
    expect(whole.total).toBe(4);
    expect(
      whole.relationships.filter(
        (relationship) => relationship.direction === 'both'
      )
    ).toHaveLength(1);
    expect(whole.diagnostics).toEqual([]);
    const section = await related(fixture.root, 'b.md#part');
    expect(section.total).toBe(3);
    expect(section.target).toMatchObject({ kind: 'section', anchor: 'part' });
    const limited = await related(fixture.root, 'b.md', { limit: 2 });
    expect(limited.relationships).toHaveLength(2);
    expect(limited).toMatchObject({
      total: 4,
      truncated: true,
      complete: true,
    });
  });
});

test('origins keep images, citations, named frontmatter fields and primary URLs distinct', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'source.md',
      '---\nabout: [person.md]\nauthors: [person.md]\nparticipants: [person.md]\nlocation: person.md\nurl: https://example.com/work\n---\n# Source\n\n![image](photo.png) Claim[^n].\n\n[^n]: Qualified [citation](person.md).\n'
    );
    await fixture.write('person.md', '# Person\n');
    await fixture.write('photo.png', 'attachment bytes');
    const result = await related(fixture.root, 'source.md');
    expect(
      result.relationships.map(({ occurrence }) => [
        occurrence.reference.origin,
        occurrence.reference.field,
        occurrence.reference.citation,
      ])
    ).toEqual([
      ['frontmatter', 'about', undefined],
      ['frontmatter', 'authors', undefined],
      ['frontmatter', 'participants', undefined],
      ['frontmatter', 'location', undefined],
      ['frontmatter', 'url', undefined],
      ['image', undefined, undefined],
      ['citation', undefined, 'n'],
    ]);
    expect((await related(fixture.root, 'photo.png')).target.kind).toBe(
      'attachment'
    );
    expect(
      (await related(fixture.root, 'photo.png')).relationships[0]?.occurrence
        .reference.origin
    ).toBe('image');
  });
});

test('unresolved outgoing links remain useful diagnosed facts', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write('a.md', '# A\n\n[missing](gone.md)\n');
    const result = await related(fixture.root, 'a.md');
    expect(result.complete).toBe(true);
    expect(result.relationships[0]?.occurrence).toMatchObject({
      sourcePath: 'a.md',
      reference: { destination: 'gone.md' },
      use: { line: 3 },
      resolution: { status: 'unresolved', reason: 'missing-target' },
    });
    expect(result.diagnostics[0]).toMatchObject({
      code: 'reference-missing-target',
      path: 'a.md',
      span: { line: 3 },
    });
  });
});

test('external resource neighborhoods converge offline and empty results differ from errors', async () => {
  await inWorkspace(async (fixture) => {
    await fixture.write(
      'a.md',
      '# A\n\n[one](https://github.com/o/r/pull/1#one)\n'
    );
    await fixture.write(
      'b.md',
      '# B\n\n[two](https://github.com/o/r/pull/1#two)\n'
    );
    expect(
      (await related(fixture.root, 'https://github.com/o/r/pull/1')).total
    ).toBe(2);
    expect(
      await related(fixture.root, 'mailto:unmentioned@example.com')
    ).toMatchObject({
      relationships: [],
      total: 0,
      truncated: false,
      complete: true,
    });
    await expect(related(fixture.root, 'missing.md')).rejects.toMatchObject({
      code: 'target-missing',
    });
    await expect(related(fixture.root, 'a.md', { limit: 0 })).rejects.toThrow(
      'positive safe integer'
    );
  });
});
