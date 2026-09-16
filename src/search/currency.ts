import type { Diagnostic } from '../documents/types.ts';
import { discoverWorkspace } from '../workspace/discovery.ts';
import {
  filesystemIO,
  operationProblem,
  type WorkspaceIO,
} from '../workspace/io.ts';
import { readFiles } from '../workspace/read-files.ts';
import { hashSource } from '../workspace/snapshots.ts';
import { readableSourcePath } from '../workspace/source-path.ts';
import { indexVersions } from './index-state.ts';
import type {
  IndexVersions,
  SourceChanges,
  SourceFingerprint,
  TextBaseline,
} from './index-types.ts';
import { selectInventory } from './selection.ts';

interface SourceInventory {
  readonly sources: readonly SourceFingerprint[];
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CurrencyResult {
  readonly currency: 'current' | 'stale' | 'unknown';
  readonly changes: SourceChanges;
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

async function sourceInventory(
  root: string,
  io: WorkspaceIO,
  selections: readonly string[]
): Promise<SourceInventory> {
  const inventory = selectInventory(
    await discoverWorkspace(root, io),
    selections
  );
  const diagnostics = [...inventory.problems];
  const sources = await readFiles(inventory.documentPaths, async (path) => {
    try {
      const source = await io.readSource(await readableSourcePath(root, path));
      return { path, hash: hashSource(source) };
    } catch (error) {
      diagnostics.push(operationProblem('index.source', path, error));
      return null;
    }
  });
  return {
    sources: sources.filter((source) => source !== null),
    complete: diagnostics.length === 0,
    diagnostics,
  };
}

function compatible(versions: IndexVersions): boolean {
  return (
    versions.discovery === indexVersions.discovery &&
    versions.parser === indexVersions.parser &&
    versions.projection === indexVersions.projection &&
    versions.qmd === indexVersions.qmd
  );
}

function changesFrom(
  sources: readonly SourceFingerprint[],
  baseline: TextBaseline
): SourceChanges {
  const previous = new Map(
    baseline.sources.map((source) => [source.path, source.hash])
  );
  const current = new Map(sources.map((source) => [source.path, source.hash]));
  return {
    added: sources
      .filter((source) => !previous.has(source.path))
      .map((source) => source.path),
    changed: sources
      .filter(
        (source) =>
          previous.has(source.path) && previous.get(source.path) !== source.hash
      )
      .map((source) => source.path),
    removed: baseline.sources
      .filter((source) => !current.has(source.path))
      .map((source) => source.path),
  };
}

export async function indexCurrency(
  root: string,
  baseline: TextBaseline | null,
  io: WorkspaceIO = filesystemIO,
  selections: readonly string[] = baseline?.selections ?? []
): Promise<CurrencyResult> {
  const inventory = await sourceInventory(root, io, selections);
  if (
    baseline === null ||
    JSON.stringify(baseline.selections) !== JSON.stringify(selections) ||
    !compatible(baseline.versions) ||
    !inventory.complete
  ) {
    return {
      currency: 'unknown',
      changes: { added: [], changed: [], removed: [] },
      complete: inventory.complete,
      diagnostics: inventory.diagnostics,
    };
  }
  const changes = changesFrom(inventory.sources, baseline);
  const stale =
    changes.added.length + changes.changed.length + changes.removed.length > 0;
  return {
    currency: stale ? 'stale' : 'current',
    changes,
    complete: true,
    diagnostics: [],
  };
}
