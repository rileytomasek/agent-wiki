import { normalizeWikiPath } from '../documents/paths.ts';
import type { DocumentSnapshot, Section } from '../documents/types.ts';
import { isDiscoveredPath } from '../workspace/discovery-policy.ts';
import { isMissing } from '../workspace/io.ts';
import { readDocument, refreshWorkspace } from '../workspace/snapshots.ts';
import { OperationError } from './errors.ts';

export interface DocumentTarget {
  readonly snapshot: DocumentSnapshot;
  readonly section?: Section;
}

interface TargetParts {
  readonly name: string;
  readonly anchor?: string;
}

/** Literal paths keep identity; aliases are declared conveniences, never basenames. */
export async function lookupDocument(
  root: string,
  target: string
): Promise<DocumentTarget> {
  validTarget(target);
  const literal = await readLiteral(root, target);
  if (literal !== undefined) return { snapshot: literal };
  const parts = splitTarget(target);
  if (parts.name !== target) {
    const snapshot = await readLiteral(root, parts.name);
    if (snapshot !== undefined) return withSection(snapshot, parts.anchor);
  }
  return lookupAlias(root, target, parts);
}

function validTarget(target: string): void {
  if (target.trim().length === 0) {
    throw new OperationError(
      'target-empty',
      'A document path or alias is required.'
    );
  }
}

async function readLiteral(
  root: string,
  target: string
): Promise<DocumentSnapshot | undefined> {
  const path = normalizeWikiPath(target);
  if (path === undefined || !path.endsWith('.md') || !isDiscoveredPath(path))
    return undefined;
  try {
    return await readDocument(root, path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    const detail =
      error instanceof Error ? error.message : 'Unknown read failure';
    throw new OperationError('target-read', `Cannot read ${target}: ${detail}`);
  }
}

function splitTarget(target: string): TargetParts {
  const hash = target.lastIndexOf('#');
  if (hash < 0) return { name: target };
  return { name: target.slice(0, hash), anchor: target.slice(hash + 1) };
}

async function lookupAlias(
  root: string,
  target: string,
  parts: TargetParts
): Promise<DocumentTarget> {
  const workspace = await refreshWorkspace(root);
  if (!workspace.complete) {
    throw new OperationError(
      'workspace-incomplete',
      'Cannot establish a unique alias because the wiki could not be read completely.'
    );
  }
  const exact = aliasMatches(workspace.documents, target);
  if (exact.length > 0) return { snapshot: uniqueAlias(exact, target) };
  const matches = aliasMatches(workspace.documents, parts.name);
  return withSection(uniqueAlias(matches, target), parts.anchor);
}

function aliasMatches(
  documents: readonly DocumentSnapshot[],
  alias: string
): readonly DocumentSnapshot[] {
  return documents.filter(
    (snapshot) => snapshot.document.metadata.aliases?.includes(alias) === true
  );
}

function uniqueAlias(
  matches: readonly DocumentSnapshot[],
  target: string
): DocumentSnapshot {
  if (matches.length > 1) {
    const candidates = matches
      .map((snapshot) => snapshot.document.path)
      .toSorted();
    throw new OperationError(
      'target-ambiguous',
      `Alias "${target}" matches several documents.`,
      candidates
    );
  }
  const snapshot = matches[0];
  if (snapshot === undefined) {
    throw unmatchedTarget(target);
  }
  return snapshot;
}

function unmatchedTarget(target: string): OperationError {
  const path = normalizeWikiPath(target);
  if (path === undefined) {
    return new OperationError(
      'target-unsafe',
      `No declared alias matches "${target}"; its path would escape or violate the wiki root boundary.`
    );
  }
  if (!isDiscoveredPath(path)) {
    return new OperationError(
      'target-excluded',
      `No declared alias matches "${target}"; its path is excluded from wiki content.`
    );
  }
  return new OperationError(
    'target-missing',
    `No document path or declared alias matches "${target}".`
  );
}

function withSection(
  snapshot: DocumentSnapshot,
  anchor: string | undefined
): DocumentTarget {
  if (anchor === undefined || anchor === '') return { snapshot };
  const decoded = decodeAnchor(anchor);
  const section = snapshot.document.sections.find(
    (candidate) => candidate.anchor === decoded
  );
  if (section === undefined) {
    throw new OperationError(
      'target-anchor-missing',
      `No heading "${decoded}" in ${snapshot.document.path}.`
    );
  }
  return { snapshot, section };
}

function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    throw new OperationError(
      'target-anchor-invalid',
      `Invalid encoded heading anchor: ${anchor}`
    );
  }
}
