import type {
  Diagnostic,
  DocumentSnapshot,
  ParsedDocument,
  Reference,
  SourceSpan,
} from '../documents/types.ts';

export interface LocalTarget {
  readonly id: string;
  readonly kind: 'document' | 'section' | 'attachment';
  readonly path: string;
  readonly anchor?: string;
  readonly title?: string;
}

export interface ExternalTarget {
  readonly id: string;
  readonly kind: 'external';
  readonly url: string;
  readonly provider?: 'github';
  readonly host?: string;
  readonly namespace?: string;
  readonly resource?: 'pull-request' | 'issue' | 'commit' | 'file';
}

export type ReferenceTarget = LocalTarget | ExternalTarget;

export type ReferenceResolution =
  | {
      readonly status: 'resolved';
      readonly target: ReferenceTarget;
      readonly selector?: string;
    }
  | {
      readonly status: 'unresolved';
      readonly reason:
        | 'invalid-destination'
        | 'missing-target'
        | 'missing-anchor'
        | 'unavailable-target';
      readonly path?: string;
      readonly anchor?: string;
    };

/** Each authored use remains distinct while sharing its original editable Reference. */
export interface ReferenceOccurrence {
  readonly id: string;
  readonly sourcePath: string;
  readonly sourceSection?: string;
  readonly reference: Reference;
  readonly use?: SourceSpan;
  readonly resolution: ReferenceResolution;
  /** Unused reference definitions remain available for moves, without graph edges. */
  readonly active: boolean;
}

export interface GraphInput {
  readonly documents: readonly DocumentSnapshot[];
  readonly files: readonly string[];
  readonly unavailable?: readonly string[];
  readonly problems?: readonly Diagnostic[];
  readonly complete?: boolean;
}

export interface ReferenceGraph {
  readonly documents: ReadonlyMap<string, ParsedDocument>;
  readonly targets: ReadonlyMap<string, ReferenceTarget>;
  readonly aliases: ReadonlyMap<string, readonly string[]>;
  readonly references: readonly ReferenceOccurrence[];
  readonly incoming: ReadonlyMap<string, readonly ReferenceOccurrence[]>;
  readonly outgoing: ReadonlyMap<string, readonly ReferenceOccurrence[]>;
  readonly diagnostics: readonly Diagnostic[];
  readonly problems: readonly Diagnostic[];
  readonly complete: boolean;
}
