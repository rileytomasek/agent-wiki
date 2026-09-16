import { parse } from 'yaml';

import { parseDocument } from '../../src/documents/parse.ts';
import type {
  DocumentSnapshot,
  WikiFrontmatter,
} from '../../src/documents/types.ts';
import type { DocumentProjection } from '../../src/search/projection.ts';

export function projectionSnapshot(
  source: string,
  path = 'notes/current.md'
): DocumentSnapshot {
  return {
    source,
    document: parseDocument({ path, source, sourceHash: 'projection-fixture' }),
  };
}

export function metadataSnapshot(
  metadata: WikiFrontmatter,
  body = '# Orchid\n\nOrchid knowledge.\n'
): DocumentSnapshot {
  return projectionSnapshot(`---\n${JSON.stringify(metadata)}\n---\n${body}`);
}

export function projectedContent(projection: DocumentProjection): string {
  if (projection.content === undefined)
    throw new Error('Expected usable projection');
  return projection.content;
}

export function projectedYaml(projection: DocumentProjection): string {
  const content = projectedContent(projection);
  const end = content.indexOf('\n---\n', 4);
  if (end < 0) throw new Error('Expected generated YAML closing delimiter');
  return content.slice(4, end + 1);
}

export function projectedHeader(projection: DocumentProjection): unknown {
  const header: unknown = parse(projectedYaml(projection));
  return header;
}
