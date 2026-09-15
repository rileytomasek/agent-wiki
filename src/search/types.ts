import type { Metadata, MetadataFilter } from './metadata.ts';

/** Absolute, caller-owned paths. The mirror contains generated qmd.metadata. */
export interface StorePaths {
  readonly dbPath: string;
  readonly mirrorPath: string;
}

export interface SearchOptions {
  readonly filter?: MetadataFilter;
  readonly limit?: number;
}

export interface SearchHit {
  /** Original path from qmd.metadata.source_path, without URL decoding. */
  readonly path: string;
  readonly title: string;
  readonly score: number;
  readonly metadata: Metadata;
}

export interface UpdateResult {
  readonly indexed: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly removed: number;
  readonly skipped: number;
  readonly needsEmbedding: number;
}

export interface EmbeddingResult {
  readonly docsProcessed: number;
  readonly chunksEmbedded: number;
  readonly errors: number;
}

export interface SearchStatus {
  readonly totalDocuments: number;
  readonly needsEmbedding: number;
  readonly pendingMetadata: number;
  readonly hasVectorIndex: boolean;
}

/** Integration baseline. Workspace projection and index coordination live above it. */
export interface SearchStore {
  update(): Promise<UpdateResult>;
  embed(): Promise<EmbeddingResult>;
  searchLex(
    query: string,
    options?: SearchOptions
  ): Promise<readonly SearchHit[]>;
  search(query: string, options?: SearchOptions): Promise<readonly SearchHit[]>;
  status(): Promise<SearchStatus>;
  close(): Promise<void>;
}
