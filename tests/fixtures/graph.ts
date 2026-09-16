import { parseDocument } from '../../src/documents/parse.ts';
import { buildGraph } from '../../src/references/graph.ts';
import type { GraphInput, ReferenceGraph } from '../../src/references/types.ts';

export function graphInput(
  sources: Readonly<Record<string, string>>,
  attachments: readonly string[] = []
): GraphInput {
  const documents = Object.entries(sources).map(([path, source]) => ({
    source,
    document: parseDocument({ path, source, sourceHash: 'fixture' }),
  }));
  return {
    documents,
    files: [...Object.keys(sources), ...attachments],
    complete: true,
  };
}

export function fixtureGraph(
  sources: Readonly<Record<string, string>>,
  attachments: readonly string[] = []
): ReferenceGraph {
  return buildGraph(graphInput(sources, attachments));
}
