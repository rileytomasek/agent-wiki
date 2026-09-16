import { assert, property, string } from 'fast-check';
import { expect, test } from 'vitest';

import { applySourceEdits, normalizeEdits } from '../src/moves/edits.ts';
import type { SourceEdit } from '../src/moves/edits.ts';

function edit(start: number, before: string, after: string): SourceEdit {
  return {
    span: { start, end: start + before.length, line: 1, column: 1 },
    before,
    after,
  };
}

test('edits retain exact unrelated Unicode, line endings, labels and comments', () => {
  const source = '😀\r\n[Label](old.md#same) <!-- keep -->\r\n';
  const patch = edit(source.indexOf('old.md'), 'old.md', '../new place.md');
  expect(applySourceEdits(source, [patch])).toBe(
    '😀\r\n[Label](../new place.md#same) <!-- keep -->\r\n'
  );
  expect(source).toBe('😀\r\n[Label](old.md#same) <!-- keep -->\r\n');
});

test('shared definition edits apply once in original offset order', () => {
  const first = edit(0, 'first.md', 'longer/new.md');
  const second = edit(9, 'second.md', 'b.md');
  const source = 'first.md second.md';
  expect(applySourceEdits(source, [second, first, first])).toBe(
    'longer/new.md b.md'
  );
  expect(normalizeEdits(source, [second, first, first])).toEqual([
    first,
    second,
  ]);
});

test('overlapping, conflicting, stale and invalid edits are refused', () => {
  expect(() =>
    applySourceEdits('abcdef', [edit(0, 'abcd', 'x'), edit(3, 'def', 'y')])
  ).toThrow('overlap');
  expect(() =>
    applySourceEdits('abc', [edit(0, 'abc', 'x'), edit(0, 'abc', 'y')])
  ).toThrow('conflicting');
  expect(() => applySourceEdits('new', [edit(0, 'old', 'x')])).toThrow(
    'no longer matches'
  );
  expect(() => applySourceEdits('abc', [edit(-1, 'ab', 'x')])).toThrow(
    'invalid source span'
  );
  expect(() => applySourceEdits('abc', [edit(1, 'abc', 'x')])).toThrow(
    'invalid source span'
  );
});

test('all untouched strings remain identical around a replacement', () => {
  assert(
    property(
      string(),
      string(),
      string(),
      string(),
      (prefix, before, after, suffix) => {
        const source = prefix + before + suffix;
        const result = applySourceEdits(source, [
          edit(prefix.length, before, after),
        ]);
        expect(result).toBe(prefix + after + suffix);
      }
    )
  );
});
