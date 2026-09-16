import { posix } from 'node:path';

import {
  normalizeDocumentPath,
  normalizeWikiPath,
  typeSegments,
} from '../documents/paths.ts';
import { OperationError } from './errors.ts';
import type { DocumentFilters, DocumentInfo } from './types.ts';

function normalizedPath(value: string, field: 'about' | 'path'): string {
  const normalized = normalizeWikiPath(value);
  if (
    normalized === undefined ||
    (field === 'about' && !normalized.endsWith('.md'))
  ) {
    throw new OperationError(
      'filter.invalid',
      `${field} must be a root-relative ${field === 'about' ? 'Markdown path' : 'path glob'}`
    );
  }
  return normalized;
}

/** Keep exact values; only filesystem identities receive path normalization. */
export function normalizeFilters(
  filters: DocumentFilters = {}
): DocumentFilters {
  for (const [field, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() === '') {
      throw new OperationError('filter.invalid', `${field} must not be empty`);
    }
  }
  return {
    ...filters,
    ...(filters.about === undefined
      ? {}
      : { about: normalizedPath(filters.about, 'about') }),
    ...(filters.path === undefined
      ? {}
      : { path: normalizedPath(filters.path, 'path') }),
  };
}

function matchesExact(
  value: string | undefined,
  expected: string | undefined
): boolean {
  return expected === undefined || value === expected;
}

function matchesType(
  document: DocumentInfo,
  filters: DocumentFilters
): boolean {
  const segments = typeSegments(document.metadata.type);
  return (
    matchesExact(document.metadata.type, filters.type) &&
    matchesExact(segments.category, filters.category) &&
    matchesExact(segments.name, filters.name)
  );
}

function matchesAbout(
  document: DocumentInfo,
  about: string | undefined
): boolean {
  if (about === undefined) return true;
  return (
    document.metadata.about?.some(
      (path) => normalizeDocumentPath(document.path, path) === about
    ) === true
  );
}

export function matchesFilters(
  document: DocumentInfo,
  filters: DocumentFilters
): boolean {
  return (
    matchesType(document, filters) &&
    matchesAbout(document, filters.about) &&
    (filters.stale !== true || document.review.stale) &&
    (filters.path === undefined ||
      posix.matchesGlob(document.path, filters.path))
  );
}
