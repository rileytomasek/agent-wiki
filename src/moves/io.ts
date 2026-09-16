import type { Stats } from 'node:fs';
import {
  chmod,
  link,
  mkdir,
  readdir,
  realpath,
  readFile,
  rename,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';

import { inspectPath } from '../workspace/io.ts';

/** Filesystem writes are replaceable to verify rollback under actual partial failures. */
export interface MoveIO {
  readonly inspect: (path: string) => Promise<Stats | null>;
  readonly read: (path: string) => Promise<string>;
  readonly write: (path: string, source: string, mode: number) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly link: (from: string, to: string) => Promise<void>;
  readonly unlink: (path: string) => Promise<void>;
  readonly mkdir: (path: string) => Promise<void>;
  readonly rmdir: (path: string) => Promise<void>;
  readonly names: (path: string) => Promise<readonly string[]>;
  readonly realpath: (path: string) => Promise<string>;
}

export const moveFilesystem: MoveIO = {
  inspect: inspectPath,
  read: (path) => readFile(path, 'utf8'),
  async write(path, source, mode) {
    await writeFile(path, source, { flag: 'wx', mode });
    await chmod(path, mode);
  },
  rename,
  link,
  unlink,
  mkdir: async (path) => {
    await mkdir(path);
  },
  rmdir,
  names: readdir,
  realpath,
};

/** Writes have a deliberate order so failure outcomes can be reconstructed. */
export async function inOrder<T>(
  values: readonly T[],
  action: (value: T) => Promise<void>
): Promise<void> {
  await values.reduce(
    (previous, value) => previous.then(() => action(value)),
    Promise.resolve()
  );
}
