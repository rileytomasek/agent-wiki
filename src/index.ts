export { openSearchStore } from './search/qmd.ts';
export type {
  EmbeddingResult,
  SearchHit,
  SearchOptions,
  SearchStatus,
  SearchStore,
  StorePaths,
  UpdateResult,
} from './search/types.ts';
export type { Metadata, MetadataFilter } from './search/metadata.ts';
export { version } from './version.ts';
export { parseDocument } from './documents/parse.ts';
export { invocationDate, reviewStatus } from './documents/dates.ts';
export type { Clock, ReviewStatus } from './documents/dates.ts';
export {
  normalizeWikiPath,
  normalizeReferencePath,
  normalizeDocumentPath,
  typeSegments,
} from './documents/paths.ts';
export type { LocalDestination, TypeSegments } from './documents/paths.ts';
export type {
  Diagnostic,
  DocumentSnapshot,
  ParsedDocument,
  ParseInput,
  SourceSpan,
  Section,
  Footnote,
  Reference,
  ReferenceOrigin,
  DestinationSyntax,
  WikiFrontmatter,
} from './documents/types.ts';
export { resolveRoot } from './workspace/root.ts';
export type { RootOptions } from './workspace/root.ts';
export {
  hashSource,
  readDocument,
  refreshWorkspace,
} from './workspace/snapshots.ts';
export type {
  RefreshOptions,
  WorkspaceSnapshot,
} from './workspace/snapshots.ts';
export type { WorkspaceIO } from './workspace/io.ts';
