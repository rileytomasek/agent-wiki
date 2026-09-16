import type { Definition, Image, Link } from 'mdast';
import { decodeString } from 'micromark-util-decode-string';

import { isEscaped, nodeSpan } from './markdown-tree.ts';
import { sourceSpan } from './spans.ts';
import type { DestinationSyntax, SourceSpan } from './types.ts';

interface Destination {
  readonly destinationSpan: SourceSpan;
  readonly syntax: DestinationSyntax;
}

export function markdownDestination(
  source: string,
  node: Definition | Image | Link,
  quoteDepth: number
): Destination | undefined {
  const span = nodeSpan(source, node);
  const text = source.slice(span.start, span.end);
  if (!text.startsWith('[') && !text.startsWith('![')) {
    return autolink(source, span, node.url);
  }
  const close = labelEnd(
    text,
    text.startsWith('!') ? 1 : 0,
    node.type !== 'definition'
  );
  const separator = node.type === 'definition' ? ':' : '(';
  if (close === undefined || text[close + 1] !== separator) return undefined;
  const offset = skipSpace(text, close + 2, quoteDepth);
  const token = destinationToken(text, offset);
  if (token === undefined) return undefined;
  if (decodeString(text.slice(token.start, token.end)) !== node.url)
    return undefined;
  return {
    syntax: token.syntax,
    destinationSpan: sourceSpan(
      source,
      span.start + token.start,
      span.start + token.end
    ),
  };
}

function autolink(
  source: string,
  span: SourceSpan,
  url: string
): Destination | undefined {
  const angle = source[span.start] === '<';
  const start = span.start + Number(angle);
  const end = span.end - Number(angle);
  const raw = source.slice(start, end);
  if (![raw, `mailto:${raw}`, `http://${raw}`].includes(url)) return undefined;
  return {
    syntax: angle ? 'angle' : 'markdown',
    destinationSpan: sourceSpan(source, start, end),
  };
}

function labelEnd(
  text: string,
  start: number,
  inlineCode: boolean
): number | undefined {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    if (isEscaped(text, index)) continue;
    if (inlineCode && text[index] === '`') {
      index = codeEnd(text, index);
      continue;
    }
    if (text[index] === '[') depth++;
    if (text[index] === ']') depth--;
    if (depth === 0) return index;
  }
  return undefined;
}

function codeEnd(text: string, start: number): number {
  const marker = /^`+/u.exec(text.slice(start))?.[0] ?? '`';
  const end = text.indexOf(marker, start + marker.length);
  return end < 0 ? start + marker.length - 1 : end + marker.length - 1;
}

function skipSpace(text: string, start: number, quoteDepth: number): number {
  let index = start;
  while (/[\t\r\n ]/u.test(text[index] ?? '') && index < text.length) {
    const newline = text[index] === '\n' || text[index] === '\r';
    index++;
    if (text[index - 1] === '\r' && text[index] === '\n') index++;
    if (newline) index = skipQuotes(text, index, quoteDepth);
  }
  return index;
}

function skipQuotes(text: string, start: number, quoteDepth: number): number {
  let index = start;
  for (let count = 0; count < quoteDepth; count++) {
    while (/[\t ]/u.test(text[index] ?? '')) index++;
    if (text[index] !== '>') break;
    index++;
  }
  return index;
}

interface Token {
  readonly start: number;
  readonly end: number;
  readonly syntax: 'angle' | 'markdown';
}

function destinationToken(text: string, start: number): Token | undefined {
  if (text[start] === '<') {
    const end = angleEnd(text, start + 1);
    return end === undefined
      ? undefined
      : { start: start + 1, end, syntax: 'angle' };
  }
  return bareToken(text, start);
}

function bareToken(text: string, start: number): Token {
  let depth = 0;
  let end = start;
  for (; end < text.length; end++) {
    if (isEscaped(text, end)) continue;
    const character = text[end] ?? '';
    if (/[\t\r\n ]/u.test(character) || (character === ')' && depth === 0))
      break;
    if (character === '(') depth++;
    if (character === ')') depth--;
  }
  return { start, end, syntax: 'markdown' };
}

function angleEnd(text: string, start: number): number | undefined {
  for (let index = start; index < text.length; index++) {
    if (text[index] === '>' && !isEscaped(text, index)) return index;
  }
  return undefined;
}
