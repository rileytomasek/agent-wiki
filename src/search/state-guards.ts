import { normalizeWikiPath } from '../documents/paths.ts';
import { arrayOf, isDiagnostic, isRecord } from '../workspace/cache-shapes.ts';
import type {
  IndexCoverage,
  IndexRun,
  IndexState,
  IndexVersions,
  SourceFingerprint,
  TextBaseline,
} from './index-types.ts';
import type { SearchStatus } from './types.ts';

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function nullableTimestamp(value: unknown): boolean {
  return value === null || timestamp(value);
}

function isVersions(value: unknown): value is IndexVersions {
  return (
    isRecord(value) &&
    ['discovery', 'parser', 'projection', 'qmd'].every(
      (key) => typeof value[key] === 'string'
    )
  );
}

function isFingerprint(value: unknown): value is SourceFingerprint {
  if (!isRecord(value)) return false;
  const path = value['path'];
  return (
    typeof path === 'string' &&
    path.endsWith('.md') &&
    normalizeWikiPath(path) === path &&
    typeof value['hash'] === 'string' &&
    /^[a-f0-9]{64}$/u.test(value['hash'])
  );
}

function isBaseline(value: unknown): value is TextBaseline {
  return (
    isRecord(value) &&
    timestamp(value['at']) &&
    isVersions(value['versions']) &&
    arrayOf(value['sources'], isFingerprint)
  );
}

function isCoverage(value: unknown): value is IndexCoverage {
  return (
    isRecord(value) &&
    count(value['discovered']) &&
    count(value['readable']) &&
    count(value['projected']) &&
    typeof value['complete'] === 'boolean'
  );
}

function isRun(value: unknown): value is IndexRun {
  return (
    isRecord(value) &&
    timestamp(value['startedAt']) &&
    typeof value['stage'] === 'string' &&
    ['refresh', 'mirror', 'update', 'embed', 'complete', 'failed'].includes(
      value['stage']
    )
  );
}

function isQmdStatus(value: unknown): value is SearchStatus {
  return (
    isRecord(value) &&
    count(value['totalDocuments']) &&
    count(value['needsEmbedding']) &&
    count(value['pendingMetadata']) &&
    typeof value['hasVectorIndex'] === 'boolean'
  );
}

function optionalRecords(value: Readonly<Record<string, unknown>>): boolean {
  return (
    (value['baseline'] === null || isBaseline(value['baseline'])) &&
    (value['qmd'] === null || isQmdStatus(value['qmd'])) &&
    nullableTimestamp(value['lastCompletedAt']) &&
    nullableTimestamp(value['textUpdatedAt']) &&
    nullableTimestamp(value['countsAt'])
  );
}

export function isIndexState(value: unknown): value is IndexState {
  return (
    isRecord(value) &&
    value['version'] === 1 &&
    optionalRecords(value) &&
    isCoverage(value['coverage']) &&
    isRun(value['run']) &&
    arrayOf(value['diagnostics'], isDiagnostic)
  );
}
