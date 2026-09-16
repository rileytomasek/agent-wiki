import { isAlias, isScalar, isSeq } from 'yaml';
import type { Document } from 'yaml';

import { isCalendarDate, isTimestampOrDate } from './dates.ts';
import { normalizeDocumentPath } from './paths.ts';
import type { WikiFrontmatter } from './types.ts';

type FieldValue = string | readonly string[];
type Validator = (value: string, path: string) => boolean;

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function validType(value: string): boolean {
  return value.split('/').every((segment) => nonempty(segment));
}

function validUrl(value: string): boolean {
  if (/\s/u.test(value) || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function validEmail(value: string): boolean {
  const address =
    /^[^\s@<>()[\]:;,"\\]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
  return (
    !value.startsWith('.') &&
    !value.includes('.@') &&
    !value.includes('..') &&
    address.test(value)
  );
}

function validDocumentPath(value: string, path: string): boolean {
  if (!nonempty(value) || /[\r\n]/u.test(value)) return false;
  return normalizeDocumentPath(path, value) !== undefined;
}

const scalarValidators: Readonly<
  Partial<Record<keyof WikiFrontmatter, Validator>>
> = {
  type: validType,
  stale_after: isCalendarDate,
  url: validUrl,
  email: validEmail,
  phone: nonempty,
  address: nonempty,
  starts_at: isTimestampOrDate,
  ends_at: isTimestampOrDate,
  published_at: isTimestampOrDate,
  location: validDocumentPath,
};

const listValidators: Readonly<
  Partial<Record<keyof WikiFrontmatter, Validator>>
> = {
  aliases: nonempty,
  about: validDocumentPath,
  authors: validDocumentPath,
  participants: validDocumentPath,
};

export function isFrontmatterField(
  value: string
): value is keyof WikiFrontmatter {
  return (
    Object.hasOwn(scalarValidators, value) ||
    Object.hasOwn(listValidators, value)
  );
}

export function isReferenceField(field: keyof WikiFrontmatter): boolean {
  return ['about', 'authors', 'participants', 'location', 'url'].includes(
    field
  );
}

export function resolveYamlNode(value: unknown, document: Document): unknown {
  return isAlias(value) ? value.resolve(document) : value;
}

function scalarString(value: unknown, document: Document): string | undefined {
  const resolved = resolveYamlNode(value, document);
  return isScalar(resolved) && typeof resolved.value === 'string'
    ? resolved.value
    : undefined;
}

function stringList(
  value: unknown,
  document: Document
): readonly string[] | undefined {
  const resolved = resolveYamlNode(value, document);
  if (!isSeq(resolved)) return undefined;
  const strings = resolved.items.map((item) => scalarString(item, document));
  return strings.every((item) => item !== undefined) ? strings : undefined;
}

/** Validate decoded YAML values without coercing numbers, booleans, or nulls. */
export function frontmatterValue(
  field: keyof WikiFrontmatter,
  node: unknown,
  document: Document,
  path: string
): FieldValue | undefined {
  const scalar = scalarValidators[field];
  if (scalar !== undefined) {
    const value = scalarString(node, document);
    return value !== undefined && scalar(value, path) ? value : undefined;
  }
  const validateItem = listValidators[field];
  const values = stringList(node, document);
  if (validateItem === undefined || values === undefined) return undefined;
  return values.every((value) => validateItem(value, path))
    ? values
    : undefined;
}
