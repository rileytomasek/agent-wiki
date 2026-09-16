import type { MoveIO } from './io.ts';
import type { MoveFileChange, MovePlan } from './types.ts';

export interface StagedChange {
  readonly change: MoveFileChange;
  readonly source: string;
  readonly destination: string;
  readonly stage: string;
  readonly backup: string;
  staged: boolean;
  backedUp: boolean;
  committed: boolean;
}

export interface MoveTransaction {
  readonly plan: MovePlan;
  readonly io: MoveIO;
  readonly entries: StagedChange[];
  readonly directories: string[];
}
