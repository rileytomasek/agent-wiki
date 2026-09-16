import type { Diagnostic } from '../documents/types.ts';
import type {
  ReferenceOccurrence,
  ReferenceTarget,
} from '../references/types.ts';

export interface RelatedOptions {
  readonly limit?: number;
}

export interface RelatedRelationship {
  readonly direction: 'incoming' | 'outgoing' | 'both';
  readonly occurrence: ReferenceOccurrence;
}

export interface RelatedResult {
  readonly target: ReferenceTarget;
  readonly relationships: readonly RelatedRelationship[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly complete: boolean;
}

export interface ValidationResult {
  readonly selectedPaths: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly complete: boolean;
  readonly valid: boolean;
}
