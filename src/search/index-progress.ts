import { writeIndexState } from './index-state.ts';
import type { IndexOptions, IndexResult, IndexState } from './index-types.ts';

export interface IndexProgress {
  readonly root: string;
  readonly options: IndexOptions;
  state: IndexState;
  update: IndexResult['update'];
  embedding: IndexResult['embedding'];
}

export function indexTime(options: IndexOptions): string {
  return (options.clock?.() ?? new Date()).toISOString();
}

export async function checkpoint(
  progress: IndexProgress,
  stage: IndexState['run']['stage']
): Promise<void> {
  progress.state = { ...progress.state, run: { ...progress.state.run, stage } };
  await writeIndexState(progress.root, progress.state);
}
