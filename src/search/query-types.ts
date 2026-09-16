import type { Clock, ReviewStatus } from '../documents/dates.ts';
import type { Diagnostic } from '../documents/types.ts';
import type { DocumentFilters } from '../operations/types.ts';
import type { IndexStatusResult } from './index-types.ts';
import type { Metadata } from './metadata.ts';
import type { SearchHit, SearchOptions, SearchStore } from './types.ts';

export type SearchFilters = Omit<DocumentFilters, 'path'>;

export interface WikiSearchOptions {
  readonly filters?: SearchFilters;
  readonly limit?: number;
  readonly clock?: Clock;
  /** Store opened for this root with indexPaths(root); the caller owns its lifetime. */
  readonly store?: SearchStore;
  /** Test/integration seam; normal searches use QMD's native hybrid pipeline. */
  readonly search?: (
    store: SearchStore,
    query: string,
    options: SearchOptions
  ) => Promise<readonly SearchHit[]>;
}

export interface SearchDocument {
  readonly path: string;
  readonly title: string;
  readonly score: number;
  readonly metadata: Metadata;
  readonly review: ReviewStatus;
  readonly snippet: {
    readonly text: string;
    /** Native snippet header positions refer to generated, indexed content. */
    readonly source: 'index';
  };
}

export interface SearchIndexNotice {
  readonly status: 'stale' | 'incomplete' | 'unknown';
  readonly currency: IndexStatusResult['currency'];
  readonly message: string;
  readonly recoveryCommand:
    | 'wiki index'
    | 'wiki index --rebuild'
    | 'wiki index --rebuild <selections...>';
  readonly diagnostics: readonly Diagnostic[];
}

export interface WikiSearchResult {
  readonly documents: readonly SearchDocument[];
  /** QMD does not expose exhaustive totals or a truncation signal. */
  readonly total: null;
  readonly truncated: null;
  /** One snapshot-level notice, never repeated on individual documents. */
  readonly indexNotice: SearchIndexNotice | null;
  readonly complete: boolean;
}
