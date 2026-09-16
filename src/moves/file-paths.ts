import { dirname, join, posix, resolve } from 'node:path';

import { normalizeWikiPath } from '../documents/paths.ts';
import { OperationError } from '../operations/errors.ts';
import { isDiscoveredPath } from '../workspace/discovery-policy.ts';
import { inOrder } from './io.ts';
import type { MoveIO } from './io.ts';

export function authoredPath(root: string, path: string): string {
  if (
    normalizeWikiPath(path) !== path ||
    !path.endsWith('.md') ||
    !isDiscoveredPath(path)
  )
    throw new OperationError(
      'move-path',
      `Expected a visible, root-relative Markdown path: ${path}`
    );
  return join(resolve(root), path);
}

function ancestorPaths(root: string, path: string): readonly string[] {
  authoredPath(root, path);
  let current = resolve(root);
  return posix
    .dirname(path)
    .split('/')
    .filter((part) => part !== '.')
    .map((part) => {
      current = join(current, part);
      return current;
    });
}

export async function checkAncestors(
  root: string,
  path: string,
  io: MoveIO
): Promise<void> {
  await Promise.all(
    ancestorPaths(root, path).map(async (directory) => {
      const info = await io.inspect(directory);
      if (info !== null && !info.isDirectory())
        throw new OperationError(
          'move-parent',
          `Refusing a symlink or non-directory parent: ${directory}`
        );
    })
  );
}

export async function createParents(
  root: string,
  path: string,
  io: MoveIO,
  created: string[]
): Promise<void> {
  await inOrder(ancestorPaths(root, path), async (directory) => {
    const info = await io.inspect(directory);
    if (info === null) {
      await io.mkdir(directory);
      created.push(directory);
    } else if (!info.isDirectory()) {
      throw new OperationError(
        'move-parent',
        `Refusing a symlink or non-directory parent: ${directory}`
      );
    }
  });
}

export function sameParent(from: string, to: string): boolean {
  return dirname(from) === dirname(to);
}

/** Replacing a regular file can invalidate a symlink's own relative references. */
export async function refuseLinkedSources(
  root: string,
  sources: readonly string[],
  files: readonly string[],
  io: MoveIO
): Promise<void> {
  const targets = new Set(
    await Promise.all(
      sources.map((path) => io.realpath(authoredPath(root, path)))
    )
  );
  const aliases = await Promise.all(
    files.map(async (path) => {
      const absolute = join(root, path);
      if ((await io.inspect(absolute))?.isSymbolicLink() !== true) return [];
      return targets.has(await io.realpath(absolute)) ? [path] : [];
    })
  );
  const affected = aliases.flat();
  if (affected.length > 0)
    throw new OperationError(
      'move-symlink-target',
      `Moving or rewriting affected sources would change file symlinks: ${affected.join(', ')}`,
      affected
    );
}
