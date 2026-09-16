import { writeFile } from 'node:fs/promises';

import { moveFilesystem } from '../../src/moves/io.ts';
import type { MoveIO } from '../../src/moves/io.ts';

export function blockedLink(path: string): MoveIO {
  return {
    ...moveFilesystem,
    async link(from, to) {
      if (to === path)
        throw new Error('Injected replacement and restore failure');
      await moveFilesystem.link(from, to);
    },
  };
}

export function retainedBackup(): MoveIO {
  return {
    ...moveFilesystem,
    async unlink(path) {
      if (path.endsWith('.backup')) throw new Error('Keep backup');
      await moveFilesystem.unlink(path);
    },
  };
}

export function uncertainLink(path: string): MoveIO {
  return {
    ...moveFilesystem,
    async link(from, to) {
      await moveFilesystem.link(from, to);
      if (to === path) throw new Error('Lost replacement acknowledgement');
    },
  };
}

export function occupiedDestination(path: string): MoveIO {
  return {
    ...moveFilesystem,
    async link(from, to) {
      if (to === path) await writeFile(to, 'Concurrent writer', { flag: 'wx' });
      await moveFilesystem.link(from, to);
    },
  };
}

export function isReferenceBackup(path: string): boolean {
  return path.includes('.ref.md.wiki-move-') && path.endsWith('.backup');
}
