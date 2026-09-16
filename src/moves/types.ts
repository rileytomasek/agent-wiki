import type { Diagnostic } from '../documents/types.ts';
import type { SourceEdit } from './edits.ts';

/** One authored file's exact content and path changes, before any writes. */
export interface MoveFileChange {
  readonly path: string;
  readonly destination: string;
  readonly before: string;
  readonly after: string;
  readonly sourceHash: string;
  readonly edits: readonly SourceEdit[];
}

/** A source-authoritative plan; apply must recheck the entire inventory. */
export interface MovePlan {
  readonly root: string;
  readonly from: string;
  readonly to: string;
  readonly changes: readonly MoveFileChange[];
  /** Original content hashes for every discovered Markdown document. */
  readonly fingerprints: Readonly<Record<string, string>>;
  /** Every discovered file, including attachments, at planning time. */
  readonly files: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}
