import { Buffer } from 'node:buffer';

import { expect, test } from 'vitest';

import { projectDocument } from '../src/search/projection.ts';
import {
  metadataSnapshot,
  projectedContent,
  projectedHeader,
  projectedYaml,
  projectionSnapshot,
} from './fixtures/projection.ts';

test.each(['a'.repeat(1024), '😀'.repeat(512)])(
  '1024 UTF-16 units are accepted independently of UTF-8 size',
  (address) => {
    const projection = projectDocument(metadataSnapshot({ address }));
    expect(projection.metadata['address']).toBe(address);
    expect(projection.diagnostics).toEqual([]);
    expect(projectedHeader(projection)).toEqual({
      qmd: { metadata: projection.metadata },
    });
  }
);

test.each(['a'.repeat(1025), '😀'.repeat(513)])(
  'oversized scalar metadata is omitted without invalidating source',
  (address) => {
    const snapshot = metadataSnapshot({ address, phone: '555' });
    const projection = projectDocument(snapshot);
    expect(snapshot.document.diagnostics).toEqual([]);
    expect(projection.metadata).not.toHaveProperty('address');
    expect(projection.metadata['phone']).toBe('555');
    expect(projection.diagnostics).toMatchObject([
      {
        code: 'projection-metadata',
        severity: 'warning',
        path: 'notes/current.md',
      },
    ]);
    expect(projectedContent(projection)).toContain('# Orchid\n');
  }
);

test('array limits are checked before QMD deduplication and an oversized item omits its field', () => {
  const maximum = Array.from({ length: 128 }, () => 'same alias');
  expect(
    projectDocument(metadataSnapshot({ aliases: maximum })).metadata['aliases']
  ).toHaveLength(128);
  const tooMany = projectDocument(
    metadataSnapshot({ aliases: [...maximum, 'same alias'] })
  );
  expect(tooMany.metadata).not.toHaveProperty('aliases');
  expect(tooMany.diagnostics[0]?.message).toContain('128 values');
  const longItem = projectDocument(
    metadataSnapshot({ aliases: ['good', 'a'.repeat(1025)] })
  );
  expect(longItem.metadata).not.toHaveProperty('aliases');
  expect(longItem.diagnostics[0]?.message).toContain('1024 UTF-16 units');
});

test('the combined UTF-8 budget includes reserved metadata and retains later fields that fit', () => {
  const about = Array.from(
    { length: 128 },
    (_, index) => `../${'あ'.repeat(64)}/${'い'.repeat(64)}/${index}.md`
  );
  const aliases = Array.from(
    { length: 128 },
    (_, index) => `${'b'.repeat(150)}${index}`
  );
  const snapshot = metadataSnapshot({
    about,
    aliases,
    email: 'author@example.test',
  });
  const projection = projectDocument(snapshot);
  expect(snapshot.document.diagnostics).toEqual([]);
  expect(projection.metadata['about']).toHaveLength(128);
  expect(projection.metadata).not.toHaveProperty('aliases');
  expect(projection.metadata).toMatchObject({
    source_path: 'notes/current.md',
    source_body_line: 4,
    title: 'Orchid',
    email: 'author@example.test',
  });
  expect(projection.diagnostics[0]?.message).toContain('65536 UTF-8 bytes');
  expect(
    Buffer.byteLength(projectedYaml(projection), 'utf8')
  ).toBeLessThanOrEqual(65_536);
  expect(projectedHeader(projection)).toEqual({
    qmd: { metadata: projection.metadata },
  });
});

test('long generated titles are omitted while body title and source identity stay usable', () => {
  const title = 'a'.repeat(1025);
  const projection = projectDocument(metadataSnapshot({}, `# ${title}\n`));
  expect(projection.metadata).not.toHaveProperty('title');
  expect(projection.metadata['source_path']).toBe('notes/current.md');
  expect(projectedContent(projection)).toContain(`# ${title}\n`);
  expect(projection.diagnostics[0]?.message).toContain('title');
});

test('unrepresentable mandatory source identity prevents an unaddressable search document', () => {
  const path = `${'a'.repeat(1022)}.md`;
  const projection = projectDocument(projectionSnapshot('# Body\n', path));
  expect(path).toHaveLength(1025);
  expect(projection.content).toBeUndefined();
  expect(projection.metadata).not.toHaveProperty('source_path');
  expect(projection.diagnostics).toMatchObject([
    { code: 'projection-identity', severity: 'error', path },
  ]);
});
