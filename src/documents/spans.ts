import type { SourceSpan } from './types.ts';

/** Build locations from the original source, preserving CRLF and Unicode. */
export function sourceSpan(
  source: string,
  start: number,
  end: number
): SourceSpan {
  const prefix = source.slice(0, start);
  const lines = prefix.split(/\r\n|\r|\n/u);
  const last = lines.at(-1) ?? '';
  return { start, end, line: lines.length, column: last.length + 1 };
}
