import {
  normalizeDocumentPath,
  normalizeReferencePath,
} from '../documents/paths.ts';
import type { LocalDestination } from '../documents/paths.ts';
import type { Reference } from '../documents/types.ts';
import { externalIdentity, isExternalReference } from './external.ts';
import { localTargetId } from './targets.ts';
import type {
  GraphInput,
  ReferenceResolution,
  ReferenceTarget,
} from './types.ts';

export interface ResolutionContext {
  readonly input: GraphInput;
  readonly targets: ReadonlyMap<string, ReferenceTarget>;
}

export function resolveReference(
  context: ResolutionContext,
  sourcePath: string,
  reference: Reference
): ReferenceResolution {
  const namedPath =
    reference.origin === 'frontmatter' && reference.field !== 'url';
  if (!namedPath && isExternalReference(reference.destination)) {
    const external = externalIdentity(reference.destination);
    return external === undefined
      ? invalid()
      : { status: 'resolved', ...external };
  }
  const local = namedPath
    ? namedDestination(sourcePath, reference.destination)
    : normalizeReferencePath(sourcePath, reference.destination);
  if (local === undefined) return invalid();
  return resolveLocal(context, local);
}

function namedDestination(
  sourcePath: string,
  destination: string
): LocalDestination | undefined {
  const path = normalizeDocumentPath(sourcePath, destination);
  return path === undefined ? undefined : { path, fragment: undefined };
}

function resolveLocal(
  context: ResolutionContext,
  local: LocalDestination
): ReferenceResolution {
  const target = context.targets.get(localTargetId(local.path));
  if (target === undefined) return missingTarget(context.input, local.path);
  if (local.fragment === undefined || local.fragment === '')
    return { status: 'resolved', target };
  if (target.kind === 'attachment')
    return { status: 'resolved', target, selector: `#${local.fragment}` };
  const section = context.targets.get(
    localTargetId(local.path, local.fragment)
  );
  return section === undefined
    ? {
        status: 'unresolved',
        reason: 'missing-anchor',
        path: local.path,
        anchor: local.fragment,
      }
    : { status: 'resolved', target: section };
}

function missingTarget(input: GraphInput, path: string): ReferenceResolution {
  const unknown =
    input.files.includes(path) ||
    input.unavailable?.some(
      (prefix) =>
        prefix === '' || path === prefix || path.startsWith(`${prefix}/`)
    ) === true;
  return {
    status: 'unresolved',
    reason: unknown ? 'unavailable-target' : 'missing-target',
    path,
  };
}

function invalid(): ReferenceResolution {
  return { status: 'unresolved', reason: 'invalid-destination' };
}
