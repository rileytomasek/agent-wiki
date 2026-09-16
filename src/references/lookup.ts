import { normalizeWikiPath } from '../documents/paths.ts';
import { externalIdentity, isExternalReference } from './external.ts';
import { localTargetId } from './targets.ts';
import type { ReferenceGraph, ReferenceTarget } from './types.ts';

export type TargetLookup =
  | { readonly status: 'resolved'; readonly target: ReferenceTarget }
  | { readonly status: 'ambiguous'; readonly candidates: readonly string[] }
  | {
      readonly status: 'unresolved';
      readonly reason:
        | 'missing'
        | 'anchor-missing'
        | 'anchor-invalid'
        | 'invalid'
        | 'incomplete';
    };

/** Lookup syntax is literal-path first, then external URL or declared alias. */
export function findGraphTarget(
  graph: ReferenceGraph,
  requested: string
): TargetLookup {
  const literal = literalTarget(graph, requested);
  if (literal !== undefined) return { status: 'resolved', target: literal };
  if (isExternalReference(requested)) {
    const external = externalIdentity(requested);
    return external === undefined
      ? { status: 'unresolved', reason: 'invalid' }
      : { status: 'resolved', target: external.target };
  }
  const { base, anchor } = requestedParts(requested);
  const local = literalTarget(graph, base);
  if (local !== undefined) return withAnchor(graph, local, anchor);
  if (!graph.complete) return { status: 'unresolved', reason: 'incomplete' };
  const exact = graph.aliases.get(requested);
  if (exact !== undefined) return aliasTarget(graph, exact);
  const alias = aliasTarget(graph, graph.aliases.get(base) ?? []);
  return alias.status === 'resolved'
    ? withAnchor(graph, alias.target, anchor)
    : alias;
}

function requestedParts(requested: string): {
  readonly base: string;
  readonly anchor?: string;
} {
  const hash = requested.lastIndexOf('#');
  return hash < 0
    ? { base: requested }
    : { base: requested.slice(0, hash), anchor: requested.slice(hash + 1) };
}

function literalTarget(
  graph: ReferenceGraph,
  requested: string
): ReferenceTarget | undefined {
  const path = normalizeWikiPath(requested);
  return path === undefined
    ? undefined
    : graph.targets.get(localTargetId(path));
}

function aliasTarget(
  graph: ReferenceGraph,
  paths: readonly string[]
): TargetLookup {
  if (paths.length > 1)
    return { status: 'ambiguous', candidates: paths.toSorted() };
  const first = paths[0];
  const target =
    first === undefined ? undefined : graph.targets.get(localTargetId(first));
  return target === undefined
    ? { status: 'unresolved', reason: 'missing' }
    : { status: 'resolved', target };
}

function withAnchor(
  graph: ReferenceGraph,
  target: ReferenceTarget,
  anchor: string | undefined
): TargetLookup {
  if (anchor === undefined || anchor === '' || target.kind === 'attachment')
    return { status: 'resolved', target };
  if (target.kind === 'external') return { status: 'resolved', target };
  try {
    const section = graph.targets.get(
      localTargetId(target.path, decodeURIComponent(anchor))
    );
    return section === undefined
      ? { status: 'unresolved', reason: 'anchor-missing' }
      : { status: 'resolved', target: section };
  } catch {
    return { status: 'unresolved', reason: 'anchor-invalid' };
  }
}
