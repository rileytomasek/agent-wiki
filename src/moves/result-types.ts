import type { Diagnostic } from '../documents/types.ts';
import type { MoveIO } from './io.ts';
import type { MovePlan } from './types.ts';

export interface MoveOptions {
  readonly dryRun?: boolean;
  readonly io?: MoveIO;
}

export interface MoveResult {
  readonly status: 'dry-run' | 'applied' | 'rolled-back' | 'partial';
  /** False for a failed request even when every original was restored. */
  readonly complete: boolean;
  readonly plan: MovePlan;
  readonly diagnostics: readonly Diagnostic[];
  /** Retained originals/staging files for explicit inspection after a failure. */
  readonly recoveryPaths: readonly string[];
  /** Current literal directory-entry and content state of every affected path. */
  readonly files: readonly MoveFileOutcome[];
}

export interface MoveFileOutcome {
  readonly path: string;
  readonly state: 'original' | 'planned' | 'changed' | 'missing' | 'unreadable';
}
