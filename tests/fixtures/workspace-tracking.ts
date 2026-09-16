import { setTimeout } from 'node:timers/promises';

import { filesystemIO, type WorkspaceIO } from '../../src/workspace/io.ts';

interface ReadTracker {
  readonly io: WorkspaceIO;
  readonly sourcePeak: () => number;
  readonly directoryPeak: () => number;
}

export function trackReads(): ReadTracker {
  let sources = 0;
  let directories = 0;
  let sourcePeak = 0;
  let directoryPeak = 0;
  return {
    sourcePeak: () => sourcePeak,
    directoryPeak: () => directoryPeak,
    io: {
      async readSource(path) {
        sources += 1;
        sourcePeak = Math.max(sourcePeak, sources);
        try {
          await setTimeout(5);
          return await filesystemIO.readSource(path);
        } finally {
          sources -= 1;
        }
      },
      async readDirectory(path) {
        directories += 1;
        directoryPeak = Math.max(directoryPeak, directories);
        try {
          await setTimeout(1);
          return await filesystemIO.readDirectory(path);
        } finally {
          directories -= 1;
        }
      },
    },
  };
}
