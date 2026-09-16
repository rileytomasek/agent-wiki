import type { Clock } from '../documents/dates.ts';
import type { Diagnostic } from '../documents/types.ts';
import type { WorkspaceIO } from '../workspace/io.ts';
import type {
  EmbeddingResult,
  SearchStatus,
  SearchStore,
  UpdateResult,
} from './types.ts';

export interface SourceFingerprint {
  readonly path: string;
  readonly hash: string;
}

export interface IndexVersions {
  readonly discovery: string;
  readonly parser: string;
  readonly projection: string;
  readonly qmd: string;
}

export interface TextBaseline {
  readonly at: string;
  readonly selections: readonly string[];
  readonly versions: IndexVersions;
  readonly sources: readonly SourceFingerprint[];
}

export interface IndexCoverage {
  readonly discovered: number;
  readonly readable: number;
  readonly projected: number;
  readonly complete: boolean;
}

export type IndexStage =
  | 'refresh'
  | 'mirror'
  | 'update'
  | 'embed'
  | 'complete'
  | 'failed';

export interface IndexRun {
  readonly startedAt: string;
  readonly stage: IndexStage;
}

export interface IndexState {
  readonly version: 2;
  readonly selections: readonly string[];
  readonly baseline: TextBaseline | null;
  readonly textUpdatedAt: string | null;
  readonly lastCompletedAt: string | null;
  readonly run: IndexRun;
  readonly coverage: IndexCoverage;
  readonly qmd: SearchStatus | null;
  readonly countsAt: string | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface IndexOptions {
  /** Root-relative files, directories or globs. Omit to reuse saved selections; [] selects all. */
  readonly selections?: readonly string[];
  readonly rebuild?: boolean;
  readonly clock?: Clock;
  readonly io?: WorkspaceIO;
  /** Embedding seam for offline integrations; normal indexing calls store.embed(). */
  readonly embed?: (store: SearchStore) => Promise<EmbeddingResult>;
}

export interface IndexResult {
  readonly root: string;
  readonly complete: boolean;
  readonly update: UpdateResult | null;
  readonly embedding: EmbeddingResult | null;
  readonly state: IndexState;
  readonly diagnostics: readonly Diagnostic[];
}

export interface SourceChanges {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
}

export interface IndexStatusResult {
  readonly root: string;
  readonly selections: readonly string[] | null;
  readonly status: 'absent' | 'current' | 'stale' | 'unknown' | 'incomplete';
  readonly availability: 'absent' | 'present' | 'unknown';
  readonly currency: 'current' | 'stale' | 'unknown';
  /** Whether this inspection covered its inputs, separate from index completeness. */
  readonly complete: boolean;
  readonly indexComplete: boolean;
  readonly coverage: IndexCoverage | null;
  readonly pendingEmbeddings: number | null;
  readonly lastTextUpdate: string | null;
  readonly lastCompletedAt: string | null;
  readonly countsAt: string | null;
  readonly run: IndexRun | null;
  readonly changes: SourceChanges;
  readonly diagnostics: readonly Diagnostic[];
}
