import { posix } from 'node:path';

export interface LocalDestination {
  readonly path: string;
  readonly fragment: string | undefined;
}

/** Normalize a literal wiki path. This never URL-decodes filesystem names. */
export function normalizeWikiPath(value: string): string | undefined {
  if (
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[a-z]:[\\/]/iu.test(value)
  ) {
    return undefined;
  }
  const normalized = posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) return undefined;
  return normalized;
}

function isExternalDestination(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
}

/** Named YAML reference fields contain literal document paths, not URIs. */
export function normalizeDocumentPath(
  sourcePath: string,
  destination: string
): string | undefined {
  if (destination.startsWith('/') || isExternalDestination(destination))
    return undefined;
  const path = normalizeWikiPath(
    posix.join(posix.dirname(sourcePath), destination)
  );
  return path?.endsWith('.md') === true ? path : undefined;
}

function decoded(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function destinationParts(value: string): LocalDestination | undefined {
  const hash = value.indexOf('#');
  const path = decoded(hash < 0 ? value : value.slice(0, hash));
  const fragment = hash < 0 ? undefined : decoded(value.slice(hash + 1));
  if (path === undefined || (hash >= 0 && fragment === undefined))
    return undefined;
  return { path, fragment };
}

/** Authored URI destinations resolve from the containing document. */
export function normalizeReferencePath(
  sourcePath: string,
  destination: string
): LocalDestination | undefined {
  if (isExternalDestination(destination)) return undefined;
  const parts = destinationParts(destination);
  if (parts === undefined) return undefined;
  const { path: file, fragment } = parts;
  if (file.startsWith('/') || file.includes('\0')) return undefined;
  const path = normalizeWikiPath(
    file === '' ? sourcePath : posix.join(posix.dirname(sourcePath), file)
  );
  return path === undefined ? undefined : { path, fragment };
}

export interface TypeSegments {
  readonly category?: string;
  readonly name?: string;
}

export function typeSegments(type: string | undefined): TypeSegments {
  if (type === undefined || !type.includes('/')) return {};
  const [category, name] = type.split('/');
  return {
    ...(category === undefined ? {} : { category }),
    ...(name === undefined ? {} : { name }),
  };
}
