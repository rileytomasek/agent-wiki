import type { SourceSpan } from '../documents/types.ts';
import { OperationError } from '../operations/errors.ts';

export interface SourceEdit {
  readonly span: SourceSpan;
  readonly before: string;
  readonly after: string;
}

/** Validate source identity and de-duplicate shared destinations before editing. */
export function normalizeEdits(
  source: string,
  edits: readonly SourceEdit[]
): readonly SourceEdit[] {
  const ordered = edits.toSorted(
    (left, right) =>
      left.span.start - right.span.start || left.span.end - right.span.end
  );
  const normalized: SourceEdit[] = [];
  for (const edit of ordered) {
    checkEdit(source, edit);
    const previous = normalized.at(-1);
    if (previous !== undefined && sameSpan(previous, edit)) {
      if (previous.before !== edit.before || previous.after !== edit.after)
        throw new OperationError(
          'move-edit-conflict',
          'A shared destination has conflicting replacements.'
        );
      continue;
    }
    if (previous !== undefined && previous.span.end > edit.span.start)
      throw new OperationError(
        'move-edit-overlap',
        'Planned source edits overlap.'
      );
    normalized.push(edit);
  }
  return normalized;
}

function sameSpan(left: SourceEdit, right: SourceEdit): boolean {
  return (
    left.span.start === right.span.start && left.span.end === right.span.end
  );
}

function checkEdit(source: string, edit: SourceEdit): void {
  const { start, end } = edit.span;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    end > source.length
  )
    throw new OperationError(
      'move-edit-invalid',
      'A planned edit has an invalid source span.'
    );
  if (source.slice(start, end) !== edit.before)
    throw new OperationError(
      'move-edit-stale',
      'Source content no longer matches a planned edit.'
    );
}

/** Slice original UTF-16 offsets exactly; never reserialize the document. */
export function applySourceEdits(
  source: string,
  edits: readonly SourceEdit[]
): string {
  const normalized = normalizeEdits(source, edits);
  let result = '';
  let cursor = 0;
  for (const edit of normalized) {
    result += source.slice(cursor, edit.span.start) + edit.after;
    cursor = edit.span.end;
  }
  return result + source.slice(cursor);
}
