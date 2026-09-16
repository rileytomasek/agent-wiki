import type {
  Diagnostic,
  Footnote,
  Section,
  SourceSpan,
  WikiFrontmatter,
} from '../documents/types.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function onlyKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function integer(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
}

export function isSpan(value: unknown): value is SourceSpan {
  return (
    isRecord(value) &&
    onlyKeys(value, ['start', 'end', 'line', 'column']) &&
    integer(value['start'], 0) &&
    integer(value['end'], value['start']) &&
    integer(value['line'], 1) &&
    integer(value['column'], 1)
  );
}

export function arrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is readonly T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}

export function isSection(value: unknown): value is Section {
  if (!isRecord(value)) return false;
  return (
    onlyKeys(value, [
      'depth',
      'text',
      'anchor',
      'heading',
      'content',
      'parent',
    ]) &&
    integer(value['depth'], 1) &&
    value['depth'] <= 6 &&
    typeof value['text'] === 'string' &&
    typeof value['anchor'] === 'string' &&
    isSpan(value['heading']) &&
    isSpan(value['content']) &&
    optionalString(value['parent'])
  );
}

export function isFootnote(value: unknown): value is Footnote {
  return (
    isRecord(value) &&
    onlyKeys(value, ['identifier', 'definition', 'uses']) &&
    typeof value['identifier'] === 'string' &&
    (value['definition'] === undefined || isSpan(value['definition'])) &&
    arrayOf(value['uses'], isSpan)
  );
}

export function isDiagnostic(value: unknown): value is Diagnostic {
  return (
    isRecord(value) &&
    onlyKeys(value, ['code', 'severity', 'message', 'path', 'span']) &&
    typeof value['code'] === 'string' &&
    (value['severity'] === 'error' || value['severity'] === 'warning') &&
    typeof value['message'] === 'string' &&
    typeof value['path'] === 'string' &&
    (value['span'] === undefined || isSpan(value['span']))
  );
}

const listFields = ['aliases', 'about', 'authors', 'participants'];
const scalarFields = [
  'type',
  'stale_after',
  'url',
  'email',
  'phone',
  'address',
  'starts_at',
  'ends_at',
  'published_at',
  'location',
];

export function isFrontmatter(value: unknown): value is WikiFrontmatter {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, field]) => {
    if (scalarFields.includes(key)) return typeof field === 'string';
    return (
      listFields.includes(key) &&
      arrayOf(field, (item) => typeof item === 'string')
    );
  });
}

export const frontmatterFields = [...listFields, ...scalarFields];
