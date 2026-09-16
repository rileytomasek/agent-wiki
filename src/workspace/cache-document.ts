import type { ParsedDocument, Reference } from '../documents/types.ts';
import {
  arrayOf,
  frontmatterFields,
  isDiagnostic,
  isFootnote,
  isFrontmatter,
  isRecord,
  isSection,
  isSpan,
  onlyKeys,
  optionalString,
} from './cache-shapes.ts';

const syntax = [
  'markdown',
  'angle',
  'yaml-plain',
  'yaml-single',
  'yaml-double',
  'yaml-block',
];
const origins = ['link', 'image', 'citation', 'frontmatter'];

function member(value: unknown, choices: readonly string[]): boolean {
  return typeof value === 'string' && choices.includes(value);
}

function referenceDetail(value: Readonly<Record<string, unknown>>): boolean {
  return (
    optionalString(value['citation']) &&
    optionalString(value['section']) &&
    optionalString(value['definition']) &&
    (value['field'] === undefined ||
      member(value['field'], frontmatterFields)) &&
    (value['destinationSpan'] === undefined || isSpan(value['destinationSpan']))
  );
}

function isReference(value: unknown): value is Reference {
  if (!isRecord(value)) return false;
  return (
    onlyKeys(value, [
      'destination',
      'destinationSpan',
      'uses',
      'origin',
      'syntax',
      'field',
      'citation',
      'section',
      'definition',
    ]) &&
    typeof value['destination'] === 'string' &&
    arrayOf(value['uses'], isSpan) &&
    member(value['origin'], origins) &&
    member(value['syntax'], syntax) &&
    referenceDetail(value)
  );
}

function isDocumentIdentity(value: Readonly<Record<string, unknown>>): boolean {
  const path = value['path'];
  return (
    typeof path === 'string' &&
    path.endsWith('.md') &&
    !path.includes('\\') &&
    path
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..') &&
    typeof value['sourceHash'] === 'string' &&
    /^[a-f0-9]{64}$/u.test(value['sourceHash']) &&
    typeof value['title'] === 'string'
  );
}

export function isParsedDocument(value: unknown): value is ParsedDocument {
  if (!isRecord(value)) return false;
  return (
    onlyKeys(value, [
      'path',
      'sourceHash',
      'title',
      'metadata',
      'body',
      'sections',
      'footnotes',
      'references',
      'diagnostics',
      'referencesComplete',
    ]) &&
    isDocumentIdentity(value) &&
    isFrontmatter(value['metadata']) &&
    isSpan(value['body']) &&
    arrayOf(value['sections'], isSection) &&
    arrayOf(value['footnotes'], isFootnote) &&
    arrayOf(value['references'], isReference) &&
    arrayOf(value['diagnostics'], isDiagnostic) &&
    typeof value['referencesComplete'] === 'boolean'
  );
}

/** A valid-looking cache cannot hand an operation out-of-source edit spans. */
export function spansFit(document: ParsedDocument, length: number): boolean {
  const sections = document.sections.flatMap((section) => [
    section.heading,
    section.content,
  ]);
  const footnotes = document.footnotes.flatMap((note) => [
    note.definition,
    ...note.uses,
  ]);
  const references = document.references.flatMap((ref) => [
    ref.destinationSpan,
    ...ref.uses,
  ]);
  const diagnostics = document.diagnostics.map((diagnostic) => diagnostic.span);
  return [
    document.body,
    ...sections,
    ...footnotes,
    ...references,
    ...diagnostics,
  ].every((span) => span === undefined || span.end <= length);
}
