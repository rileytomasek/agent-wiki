import type { ParsedDocument } from '../documents/types.ts';
import type { GraphInput, LocalTarget, ReferenceTarget } from './types.ts';

export function localTargetId(path: string, anchor?: string): string {
  const base = `local:${encodeURIComponent(path)}`;
  return anchor === undefined ? base : `${base}#${encodeURIComponent(anchor)}`;
}

export function localTargets(input: GraphInput): Map<string, ReferenceTarget> {
  const targets = new Map<string, ReferenceTarget>();
  for (const { document } of input.documents) addDocument(targets, document);
  for (const path of input.files) {
    if (!path.endsWith('.md')) {
      const id = localTargetId(path);
      targets.set(id, { id, kind: 'attachment', path });
    }
  }
  return targets;
}

function addDocument(
  targets: Map<string, ReferenceTarget>,
  document: ParsedDocument
): void {
  const id = localTargetId(document.path);
  targets.set(id, {
    id,
    kind: 'document',
    path: document.path,
    title: document.title,
  });
  for (const section of document.sections) {
    const target: LocalTarget = {
      id: localTargetId(document.path, section.anchor),
      kind: 'section',
      path: document.path,
      anchor: section.anchor,
      title: section.text,
    };
    targets.set(target.id, target);
  }
}

export function aliasIndex(
  input: GraphInput
): ReadonlyMap<string, readonly string[]> {
  const aliases = new Map<string, string[]>();
  for (const { document } of input.documents) {
    for (const alias of new Set(document.metadata.aliases ?? [])) {
      const paths = aliases.get(alias) ?? [];
      paths.push(document.path);
      aliases.set(alias, paths);
    }
  }
  return aliases;
}
