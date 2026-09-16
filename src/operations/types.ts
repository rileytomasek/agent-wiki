import type { Clock, ReviewStatus } from '../documents/dates.ts';
import type {
  Diagnostic,
  Footnote,
  Section,
  WikiFrontmatter,
} from '../documents/types.ts';

export interface DocumentInfo {
  readonly path: string;
  readonly title: string;
  readonly metadata: WikiFrontmatter;
  readonly review: ReviewStatus;
}

export interface DocumentFilters {
  readonly type?: string;
  readonly category?: string;
  readonly name?: string;
  readonly about?: string;
  readonly stale?: boolean;
  readonly path?: string;
}

export interface ReadOptions {
  readonly clock?: Clock;
}

export interface ListOptions extends ReadOptions {
  readonly filters?: DocumentFilters;
  readonly limit?: number;
}

export interface ListResult {
  readonly documents: readonly DocumentInfo[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly complete: boolean;
}

export interface ShowResult {
  readonly document: DocumentInfo;
  readonly section?: Section;
  readonly content: string;
  readonly headingContext: readonly Section[];
  readonly footnotes: readonly Footnote[];
  readonly diagnostics: readonly Diagnostic[];
  readonly complete: boolean;
}
