import { array, assert, constantFrom, property } from 'fast-check';
import { expect, test } from 'vitest';

import {
  invocationDate,
  isCalendarDate,
  isTimestampOrDate,
  reviewStatus,
} from '../src/documents/dates.ts';
import {
  normalizeReferencePath,
  normalizeDocumentPath,
  normalizeWikiPath,
  typeSegments,
} from '../src/documents/paths.ts';

test('calendar and timestamp values reject normalization and missing timezones', () => {
  for (const valid of ['2024-02-29', '0001-01-01', '2026-09-16'])
    expect(isCalendarDate(valid)).toBe(true);
  for (const invalid of ['2026-02-29', '2026-13-01', '2026-1-01', '2026-04-31'])
    expect(isCalendarDate(invalid)).toBe(false);
  expect(isTimestampOrDate('2026-09-16T14:30:20.123-04:00')).toBe(true);
  expect(isTimestampOrDate('2026-09-16T14:30Z')).toBe(true);
  expect(isTimestampOrDate('2026-09-16T14:30:00')).toBe(false);
  expect(isTimestampOrDate('2026-02-30T14:30:00Z')).toBe(false);
});

test('review status uses an injected local calendar date and does not mutate deadlines', () => {
  const today = invocationDate(() => new Date(2026, 8, 16, 23, 59));
  expect(today).toBe('2026-09-16');
  expect(reviewStatus('2026-09-16', today)).toEqual({
    deadline: today,
    stale: true,
    daysOverdue: 0,
  });
  expect(reviewStatus('2026-09-15', today).daysOverdue).toBe(1);
  expect(reviewStatus('2026-09-17', today).stale).toBe(false);
  expect(reviewStatus(undefined, today)).toEqual({ stale: false });
  expect(() => invocationDate(() => new Date('invalid'))).toThrow(
    'invalid date'
  );
});

test('literal paths and authored destinations keep distinct decoding rules', () => {
  expect(normalizeWikiPath('a/../literal%20name.md')).toBe('literal%20name.md');
  expect(normalizeDocumentPath('docs/a.md', '../literal%20name.md')).toBe(
    'literal%20name.md'
  );
  expect(normalizeDocumentPath('a.md', 'a.md#section')).toBeUndefined();
  expect(normalizeWikiPath('docs\\a.md')).toBeUndefined();
  expect(
    normalizeReferencePath('docs/a.md', '../name%20%C3%A9.md#A%20B')
  ).toEqual({ path: 'name é.md', fragment: 'A B' });
  expect(normalizeReferencePath('docs/a.md', '#part')).toEqual({
    path: 'docs/a.md',
    fragment: 'part',
  });
  for (const unsafe of [
    '../../out.md',
    '/out.md',
    'https://example.com/a',
    '%XX.md',
  ]) {
    expect(normalizeReferencePath('docs/a.md', unsafe)).toBeUndefined();
  }
  expect(typeSegments('custom/topic/deep')).toEqual({
    category: 'custom',
    name: 'topic',
  });
  expect(typeSegments('person')).toEqual({});
});

function checkNormalized(parts: readonly string[]): void {
  const normalized = normalizeWikiPath(parts.join('/'));
  expect(normalizeWikiPath(normalized ?? '../')).toBe(normalized);
  expect(normalized ?? '').not.toMatch(/^\.\.(?:\/|$)/u);
}

test('path normalization is idempotent and cannot escape the wiki', () => {
  assert(
    property(
      array(constantFrom('a', 'é', '.', '..', 'file.md')),
      checkNormalized
    )
  );
});
