import { resolve } from 'node:path';

import type { Diagnostic } from '../documents/types.ts';
import { operationProblem, type WorkspaceIO } from '../workspace/io.ts';
import { indexCurrency } from './currency.ts';
import { databaseExists } from './index-paths.ts';
import { readIndexState } from './index-state.ts';
import type { IndexState, IndexStatusResult } from './index-types.ts';

function completeIndex(state: IndexState | null): boolean {
  return (
    state?.run.stage === 'complete' &&
    state.coverage.complete &&
    state.qmd?.needsEmbedding === 0 &&
    state.qmd.pendingMetadata === 0
  );
}

function summary(
  available: IndexStatusResult['availability'],
  currency: IndexStatusResult['currency'],
  state: IndexState | null
): IndexStatusResult['status'] {
  if (available === 'absent') return 'absent';
  if (available === 'unknown' || state === null || currency === 'unknown')
    return 'unknown';
  return completeIndex(state) ? currency : 'incomplete';
}

function recordedFields(state: IndexState | null) {
  return {
    coverage: state?.coverage ?? null,
    pendingEmbeddings: state?.qmd?.needsEmbedding ?? null,
    lastTextUpdate: state?.textUpdatedAt ?? null,
  };
}

function recordedRun(state: IndexState | null) {
  return {
    lastCompletedAt: state?.lastCompletedAt ?? null,
    countsAt: state?.countsAt ?? null,
    run: state?.run ?? null,
  };
}

async function availability(
  root: string,
  diagnostics: Diagnostic[]
): Promise<IndexStatusResult['availability']> {
  try {
    return (await databaseExists(root)) ? 'present' : 'absent';
  } catch (error) {
    diagnostics.push(operationProblem('index.database', root, error));
    return 'unknown';
  }
}

/** Recorded counts are explicitly dated; inspection never opens QMD or models. */
export async function indexStatus(
  root: string,
  options: { readonly io?: WorkspaceIO } = {}
): Promise<IndexStatusResult> {
  const absolute = resolve(root);
  const record = await readIndexState(absolute);
  const diagnostics = [...record.diagnostics];
  const available = await availability(absolute, diagnostics);
  const state = record.state;
  const currency = await indexCurrency(
    absolute,
    state?.baseline ?? null,
    options.io
  );
  return {
    root: absolute,
    status: summary(available, currency.currency, state),
    availability: available,
    currency: currency.currency,
    complete: currency.complete && diagnostics.length === 0,
    indexComplete: available === 'present' && completeIndex(state),
    ...recordedFields(state),
    ...recordedRun(state),
    changes: currency.changes,
    diagnostics: [
      ...diagnostics,
      ...currency.diagnostics,
      ...(state?.diagnostics ?? []),
    ],
  };
}
