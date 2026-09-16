import type { IndexResult, IndexStatusResult } from '../search/index-types.ts';
import { rendered } from './output.ts';
import type { CliResult } from './output.ts';

export function renderIndex(result: IndexResult, json: boolean): CliResult {
  const update = result.update;
  const changes =
    update === null
      ? 'Text update did not complete.'
      : `Text update: ${update.indexed} added, ${update.updated} changed, ${update.unchanged} unchanged, ${update.removed} removed.`;
  const pending = result.state.qmd?.needsEmbedding;
  const lines = [
    `Index ${result.complete ? 'complete' : 'incomplete'}: ${result.root}`,
    changes,
    `Source coverage: ${result.state.coverage.readable}/${result.state.coverage.discovered} readable; ${result.state.coverage.projected} projected.`,
    `Pending embeddings: ${pending ?? 'unknown'}.`,
  ];
  return rendered(
    result,
    json ? JSON.stringify(result) : lines.join('\n'),
    json
  );
}

export function renderStatus(
  result: IndexStatusResult,
  json: boolean
): CliResult {
  const lines = [
    `Root: ${result.root}`,
    `Search index: ${result.status}`,
    `Source currency: ${result.currency}`,
    `Pending embeddings: ${result.pendingEmbeddings ?? 'unknown'} (recorded ${result.countsAt ?? 'never'}).`,
    `Last text update: ${result.lastTextUpdate ?? 'never'}`,
    `Last completed index: ${result.lastCompletedAt ?? 'never'}`,
  ];
  if (result.status !== 'current')
    lines.push('Run wiki index to update or complete the index.');
  return rendered(
    result,
    json ? JSON.stringify(result) : lines.join('\n'),
    json
  );
}
