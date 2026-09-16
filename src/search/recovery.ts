import { OperationError } from '../operations/errors.ts';
import type { IndexStatusResult } from './index-types.ts';
import type { SearchIndexNotice } from './query-types.ts';

export function indexRecoveryCommand(
  status: Pick<IndexStatusResult, 'availability' | 'selections' | 'diagnostics'>
): SearchIndexNotice['recoveryCommand'] {
  const invalidState = status.diagnostics.some(
    (problem) => problem.code === 'index.state'
  );
  if (
    status.selections === null &&
    (status.availability !== 'absent' || invalidState)
  )
    return 'wiki index --rebuild <selections...>';
  return status.availability === 'unknown'
    ? 'wiki index --rebuild'
    : 'wiki index';
}

export function indexNotice(
  status: IndexStatusResult
): SearchIndexNotice | null {
  if (status.status === 'current' || status.status === 'absent') return null;
  const recoveryCommand = indexRecoveryCommand(status);
  return {
    status: status.status,
    currency: status.currency,
    message: `Search index is ${status.status}; source currency is ${status.currency}. Run ${recoveryCommand} to update it.`,
    recoveryCommand,
    diagnostics: status.diagnostics,
  };
}

export function requireIndex(status: IndexStatusResult): void {
  if (status.availability === 'absent')
    throw new OperationError(
      'search.index-missing',
      `No search index exists. Run ${indexRecoveryCommand(status)} first.`
    );
  if (status.availability === 'unknown')
    throw new OperationError(
      'search.index-unavailable',
      `The search index cannot be read. Run wiki status for details or ${indexRecoveryCommand(status)} to recreate it.`
    );
}
