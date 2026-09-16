import type { Dirent } from 'node:fs';
import { posix, resolve } from 'node:path';

import type { Diagnostic } from '../documents/types.ts';
import {
  filesystemIO,
  isMissing,
  operationProblem,
  type WorkspaceIO,
} from './io.ts';
import {
  ExcludedSourceError,
  readableDirectoryPath,
  readableSourcePath,
} from './source-path.ts';

export const DISCOVERY_VERSION = '1';
const excluded = new Set(['node_modules', 'vendor', 'dist', 'build']);

export interface Inventory {
  readonly files: readonly string[];
  readonly documentPaths: readonly string[];
  readonly problems: readonly Diagnostic[];
  readonly unavailable: readonly string[];
  readonly complete: boolean;
}

interface Scan {
  readonly root: string;
  readonly io: WorkspaceIO;
  readonly files: string[];
  readonly problems: Diagnostic[];
  readonly unavailable: string[];
}

async function acceptSymlink(scan: Scan, path: string): Promise<void> {
  try {
    await readableSourcePath(scan.root, path);
    scan.files.push(path);
  } catch (error) {
    if (error instanceof ExcludedSourceError || isMissing(error)) return;
    scan.unavailable.push(path);
    scan.problems.push(operationProblem('workspace.scan', path, error));
  }
}

async function visitEntry(scan: Scan, parent: string, entry: Dirent) {
  if (entry.name.startsWith('.') || excluded.has(entry.name)) return;
  const path = posix.join(parent, entry.name);
  if (entry.isDirectory()) await visitDirectory(scan, path);
  else if (entry.isSymbolicLink()) await acceptSymlink(scan, path);
  else if (entry.isFile()) scan.files.push(path);
}

async function visitEntries(
  scan: Scan,
  parent: string,
  entries: Iterator<Dirent, undefined>
): Promise<void> {
  const next = entries.next();
  if (next.done === true) return;
  await visitEntry(scan, parent, next.value);
  await visitEntries(scan, parent, entries);
}

async function visitDirectory(scan: Scan, path: string): Promise<void> {
  try {
    const directory = await readableDirectoryPath(scan.root, path);
    const entries = await scan.io.readDirectory(directory);
    await visitEntries(scan, path, entries.values());
  } catch (error) {
    scan.unavailable.push(path);
    scan.problems.push(operationProblem('workspace.scan', path, error));
  }
}

export async function discoverWorkspace(
  root: string,
  io: WorkspaceIO = filesystemIO
): Promise<Inventory> {
  const scan: Scan = {
    root: resolve(root),
    io,
    files: [],
    problems: [],
    unavailable: [],
  };
  await visitDirectory(scan, '');
  const files = scan.files.toSorted();
  return {
    files,
    documentPaths: files.filter((path) => path.endsWith('.md')),
    problems: scan.problems,
    unavailable: scan.unavailable,
    complete: scan.problems.length === 0,
  };
}

export function confirmsAbsence(path: string, inventory: Inventory): boolean {
  return (
    !inventory.documentPaths.includes(path) &&
    !inventory.unavailable.some(
      (directory) =>
        directory === '' ||
        path === directory ||
        path.startsWith(`${directory}/`)
    )
  );
}
