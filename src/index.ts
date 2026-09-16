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
export { listDocuments } from './operations/list.ts';
export { showDocument } from './operations/show.ts';
export { related } from './operations/related.ts';
export { validate } from './operations/validate.ts';
export { buildGraph } from './references/graph.ts';
export type {
  RelatedOptions,
  RelatedRelationship,
  RelatedResult,
  ValidationResult,
} from './operations/reference-results.ts';
export type {
  ReferenceTarget,
  ReferenceOccurrence,
  ReferenceResolution,
  ReferenceGraph,
  GraphInput,
  LocalTarget,
  ExternalTarget,
} from './references/types.ts';
export { OperationError } from './operations/errors.ts';
export type {
  DocumentInfo,
  DocumentFilters,
  ReadOptions,
  ListOptions,
  ListResult,
  ShowResult,
} from './operations/types.ts';
export { indexWiki } from './search/index.ts';
export { indexStatus } from './search/status.ts';
export { moveDocument, applyMove } from './operations/move.ts';
export { buildMovePlan } from './moves/planning.ts';
export { formatMoveDiff } from './moves/diff.ts';
export type { MovePlan, MoveFileChange } from './moves/types.ts';
export type {
  MoveOptions,
  MoveResult,
  MoveFileOutcome,
} from './moves/result-types.ts';
export type { MoveIO } from './moves/io.ts';
export type { SourceEdit } from './moves/edits.ts';
export type {
  IndexOptions,
  IndexResult,
  IndexStatusResult,
  IndexState,
  IndexCoverage,
  IndexRun,
  IndexStage,
  IndexVersions,
  SourceFingerprint,
  SourceChanges,
  TextBaseline,
} from './search/index-types.ts';
