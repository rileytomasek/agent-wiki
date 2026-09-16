import { lstat, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { isDiscoveredPath } from './discovery-policy.ts';

function withinRoot(root: string, path: string): boolean {
  const local = relative(root, path);
  return local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local);
}

function sourcePath(root: string, path: string): string {
  if (path.length === 0 || isAbsolute(path) || path.includes('\\')) {
    throw new Error(`Expected a root-relative wiki path: ${path}`);
  }
  const resolved = resolve(root, path);
  if (!withinRoot(resolve(root), resolved) || resolved === resolve(root)) {
    throw new Error(`Path escapes the wiki root: ${path}`);
  }
  const canonical = relative(resolve(root), resolved).split(sep).join('/');
  if (!isDiscoveredPath(canonical))
    throw new Error(`Document path is excluded from the wiki: ${path}`);
  return resolved;
}

async function checkDirectories(
  root: string,
  directory: string
): Promise<void> {
  const directories = relative(root, directory).split(sep).filter(Boolean);
  let current = root;
  const paths = directories.map((part) => {
    current = join(current, part);
    return current;
  });
  await Promise.all(
    paths.map(async (path) => {
      const entry = await lstat(path);
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        throw new Error(
          `Refusing a symlink or non-directory ancestor: ${path}`
        );
      }
    })
  );
}

export class ExcludedSourceError extends Error {}

export async function readableDirectoryPath(
  root: string,
  path: string
): Promise<string> {
  const absoluteRoot = resolve(root);
  const directory = path === '' ? absoluteRoot : sourcePath(absoluteRoot, path);
  await checkDirectories(absoluteRoot, directory);
  return directory;
}

/** Validate ancestors as well as a symlink file's final target. */
export async function readableSourcePath(
  root: string,
  path: string
): Promise<string> {
  const absoluteRoot = resolve(root);
  const absolutePath = sourcePath(absoluteRoot, path);
  await checkDirectories(absoluteRoot, dirname(absolutePath));
  const [realRoot, realPath] = await Promise.all([
    realpath(absoluteRoot),
    realpath(absolutePath),
  ]);
  if (!withinRoot(realRoot, realPath)) {
    throw new ExcludedSourceError(`File target escapes the wiki root: ${path}`);
  }
  if (!(await stat(realPath)).isFile()) {
    throw new ExcludedSourceError(`Not a regular file: ${path}`);
  }
  return realPath;
}
