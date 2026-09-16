import { Buffer } from 'node:buffer';

import { normalizeDocumentPath, typeSegments } from '../documents/paths.ts';
import type {
  Diagnostic,
  ParsedDocument,
  WikiFrontmatter,
} from '../documents/types.ts';
import type { Metadata } from './metadata.ts';

type Value = string | number | readonly string[];

interface Candidate {
  readonly key: string;
  readonly value: Value | undefined;
}

export interface ProjectionMetadata {
  readonly metadata: Metadata;
  readonly diagnostics: readonly Diagnostic[];
}

// Pinned QMD metadata contract; prove acceptance through its public store API.
const limits = {
  frontmatterBytes: 65_536,
  keys: 64,
  keyBytes: 128,
  stringLength: 1024,
  arrayLength: 128,
};
const fields: readonly (keyof WikiFrontmatter)[] = [
  'type',
  'about',
  'stale_after',
  'aliases',
  'url',
  'email',
  'phone',
  'address',
  'starts_at',
  'ends_at',
  'published_at',
  'authors',
  'participants',
  'location',
];
const documentLists = new Set<keyof WikiFrontmatter>([
  'about',
  'authors',
  'participants',
]);

export function metadataYaml(metadata: Metadata): string {
  // JSON scalar/array syntax is YAML 1.2, with dates and control bytes quoted.
  return `qmd:\n  metadata: ${JSON.stringify(metadata)}\n`;
}

function normalizedValue(
  path: string,
  field: keyof WikiFrontmatter,
  value: string | readonly string[]
): Value | undefined {
  if (field === 'location') {
    return typeof value === 'string'
      ? normalizeDocumentPath(path, value)
      : undefined;
  }
  if (!documentLists.has(field)) return value;
  if (typeof value === 'string') return undefined;
  const paths = value.map((destination) =>
    normalizeDocumentPath(path, destination)
  );
  return paths.every((destination) => destination !== undefined)
    ? paths
    : undefined;
}

function candidates(document: ParsedDocument): readonly Candidate[] {
  const segments = typeSegments(document.metadata.type);
  const derived = [
    ...(segments.category === undefined
      ? []
      : [{ key: 'category', value: segments.category }]),
    ...(segments.name === undefined
      ? []
      : [{ key: 'name', value: segments.name }]),
  ];
  const authored = fields.flatMap((key) => {
    const value = document.metadata[key];
    return value === undefined
      ? []
      : [{ key, value: normalizedValue(document.path, key, value) }];
  });
  return [
    { key: 'source_path', value: document.path },
    { key: 'source_body_line', value: document.body.line },
    { key: 'title', value: document.title },
    ...derived,
    ...authored,
  ];
}

function valueProblem(value: Value): string | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? undefined : 'number is not finite';
  if (typeof value === 'string')
    return value.length <= limits.stringLength
      ? undefined
      : `string exceeds ${limits.stringLength} UTF-16 units`;
  if (value.length > limits.arrayLength)
    return `array exceeds ${limits.arrayLength} values`;
  if (value.some((item) => item.length > limits.stringLength))
    return `array string exceeds ${limits.stringLength} UTF-16 units`;
  return undefined;
}

function admissionProblem(
  candidate: Candidate,
  metadata: Metadata
): string | undefined {
  if (candidate.value === undefined)
    return 'document reference could not be normalized';
  if (candidate.key === 'source_path' && candidate.value === '')
    return 'source identity is empty';
  const invalid = valueProblem(candidate.value);
  if (invalid !== undefined) return invalid;
  if (Buffer.byteLength(candidate.key, 'utf8') > limits.keyBytes)
    return `key exceeds ${limits.keyBytes} UTF-8 bytes`;
  if (Object.keys(metadata).length >= limits.keys)
    return `metadata exceeds ${limits.keys} keys`;
  const expanded = { ...metadata, [candidate.key]: candidate.value };
  if (
    Buffer.byteLength(metadataYaml(expanded), 'utf8') > limits.frontmatterBytes
  )
    return `frontmatter exceeds ${limits.frontmatterBytes} UTF-8 bytes`;
  return undefined;
}

function omittedField(
  document: ParsedDocument,
  field: string,
  reason: string
): Diagnostic {
  const required = field === 'source_path';
  return {
    code: required ? 'projection-identity' : 'projection-metadata',
    severity: required ? 'error' : 'warning',
    path: document.path,
    message: `Omitted search metadata ${field}: ${reason}.`,
  };
}

/** Reserve source identity before optional fields and omit whole unusable values. */
export function projectionMetadata(
  document: ParsedDocument
): ProjectionMetadata {
  const metadata: Record<string, Metadata[string]> = {};
  const diagnostics: Diagnostic[] = [];
  for (const candidate of candidates(document)) {
    const value = candidate.value;
    if (typeof value === 'object' && value.length === 0) continue;
    const problem = admissionProblem(candidate, metadata);
    if (problem !== undefined) {
      diagnostics.push(omittedField(document, candidate.key, problem));
      continue;
    }
    if (value !== undefined) metadata[candidate.key] = value;
  }
  return { metadata, diagnostics };
}
