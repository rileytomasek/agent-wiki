import { isMap, isScalar, parseDocument } from 'yaml';
import type { Pair } from 'yaml';

import {
  frontmatterValue,
  isFrontmatterField,
  isReferenceField,
} from './frontmatter-fields.ts';
import { frontmatterReferences, yamlSpan } from './frontmatter-references.ts';
import type { FrontmatterContext } from './frontmatter-references.ts';
import { sourceSpan } from './spans.ts';
import type {
  Diagnostic,
  ParseInput,
  Reference,
  SourceSpan,
  WikiFrontmatter,
} from './types.ts';

export interface FrontmatterResult {
  readonly metadata: WikiFrontmatter;
  readonly body: SourceSpan;
  readonly references: readonly Reference[];
  readonly diagnostics: readonly Diagnostic[];
  readonly referencesComplete: boolean;
}

interface FrontmatterBlock {
  readonly start: number;
  readonly end: number;
  readonly body: number;
}

function frontmatterBlock(source: string): FrontmatterBlock | undefined {
  const opening = /^(?:\uFEFF)?---[\t ]*(?:\r\n|\n|\r|$)/u.exec(source);
  if (opening === null) return undefined;
  const start = opening[0].length;
  const closing = /^(?:---|\.\.\.)[\t ]*(?:\r\n|\n|\r|$)/mu.exec(
    source.slice(start)
  );
  if (closing === null) return { start, end: source.length, body: 0 };
  const end = start + closing.index;
  return { start, end, body: end + closing[0].length };
}

function diagnostic(
  context: FrontmatterContext,
  code: string,
  message: string,
  node: unknown
): Diagnostic {
  return {
    code,
    message,
    severity: 'error',
    path: context.input.path,
    span: yamlSpan(node, context),
  };
}

function keyCounts(pairs: readonly Pair[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const { key } of pairs) {
    if (isScalar(key) && typeof key.value === 'string') {
      counts.set(key.value, (counts.get(key.value) ?? 0) + 1);
    }
  }
  return counts;
}

function fieldResult(
  pair: Pair,
  count: number,
  context: FrontmatterContext
): Omit<FrontmatterResult, 'body'> {
  const empty = {
    metadata: {},
    references: [],
    diagnostics: [],
    referencesComplete: true,
  };
  const key = isScalar(pair.key) ? pair.key.value : undefined;
  if (typeof key !== 'string') {
    return {
      ...empty,
      referencesComplete: false,
      diagnostics: [
        diagnostic(
          context,
          'frontmatter-key',
          'Frontmatter keys must be strings',
          pair.key
        ),
      ],
    };
  }
  if (!isFrontmatterField(key)) {
    return {
      ...empty,
      diagnostics: [
        diagnostic(
          context,
          'frontmatter-unknown',
          `Unknown frontmatter field: ${key}`,
          pair.key
        ),
      ],
    };
  }
  return knownFieldResult(pair, key, count, context);
}

function knownFieldResult(
  pair: Pair,
  key: keyof WikiFrontmatter,
  count: number,
  context: FrontmatterContext
): Omit<FrontmatterResult, 'body'> {
  const value = frontmatterValue(
    key,
    pair.value,
    context.document,
    context.input.path
  );
  const references = isReferenceField(key)
    ? frontmatterReferences(key, pair.value, context)
    : [];
  const diagnostics: Diagnostic[] = [];
  if (count > 1)
    diagnostics.push(
      diagnostic(
        context,
        'frontmatter-duplicate',
        `Duplicate frontmatter field: ${key}`,
        pair.key
      )
    );
  if (value === undefined)
    diagnostics.push(
      diagnostic(
        context,
        'frontmatter-value',
        `Invalid value for frontmatter field: ${key}`,
        pair.value
      )
    );
  return {
    metadata: value !== undefined && count === 1 ? { [key]: value } : {},
    references,
    diagnostics,
    referencesComplete:
      (!isReferenceField(key) || value !== undefined) &&
      references.every((reference) => reference.destinationSpan !== undefined),
  };
}

function parseMapping(
  context: FrontmatterContext,
  body: SourceSpan
): FrontmatterResult {
  const contents = context.document.contents;
  if (contents === null)
    return {
      metadata: {},
      body,
      references: [],
      diagnostics: [],
      referencesComplete: true,
    };
  if (!isMap(contents)) {
    return {
      metadata: {},
      body,
      references: [],
      diagnostics: [
        diagnostic(
          context,
          'frontmatter-shape',
          'Frontmatter must be a mapping of fields',
          contents
        ),
      ],
      referencesComplete: false,
    };
  }
  const counts = keyCounts(contents.items);
  const fields = contents.items.map((pair) => {
    const key = isScalar(pair.key) ? pair.key.value : undefined;
    return fieldResult(
      pair,
      typeof key === 'string' ? (counts.get(key) ?? 0) : 0,
      context
    );
  });
  return {
    metadata: fields.reduce<WikiFrontmatter>(
      (metadata, field) => Object.assign(metadata, field.metadata),
      {}
    ),
    body,
    references: fields.flatMap((field) => field.references),
    diagnostics: fields.flatMap((field) => field.diagnostics),
    referencesComplete: fields.every((field) => field.referencesComplete),
  };
}

/** Parse only an optional leading YAML block; retain offsets in original text. */
export function parseFrontmatter(input: ParseInput): FrontmatterResult {
  const block = frontmatterBlock(input.source);
  const body = sourceSpan(input.source, block?.body ?? 0, input.source.length);
  const empty = {
    metadata: {},
    body,
    references: [],
    diagnostics: [],
    referencesComplete: true,
  };
  if (block === undefined) return empty;
  if (block.body === 0) {
    return {
      ...empty,
      referencesComplete: false,
      diagnostics: [
        {
          code: 'frontmatter-unclosed',
          severity: 'error',
          path: input.path,
          message: 'Leading YAML frontmatter has no closing delimiter',
          span: sourceSpan(input.source, 0, block.start),
        },
      ],
    };
  }
  const yaml = input.source
    .slice(block.start, block.end)
    .replaceAll(/\r(?!\n)/gu, '\n');
  const document = parseDocument(yaml, {
    keepSourceTokens: true,
    uniqueKeys: false,
    version: '1.2',
  });
  const context = { input, document, offset: block.start };
  const errors = [...document.errors, ...document.warnings];
  if (errors.length > 0) {
    return {
      ...empty,
      referencesComplete: false,
      diagnostics: errors.map((error) => ({
        code: 'frontmatter-yaml',
        severity: 'error',
        path: input.path,
        message: error.message,
        span: sourceSpan(
          input.source,
          block.start + error.pos[0],
          block.start + error.pos[1]
        ),
      })),
    };
  }
  return parseMapping(context, body);
}
