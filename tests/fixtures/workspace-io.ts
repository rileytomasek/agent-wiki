import { filesystemIO, type WorkspaceIO } from '../../src/workspace/io.ts';

export function failDirectory(suffix: string): WorkspaceIO {
  return {
    ...filesystemIO,
    readDirectory(path) {
      if (path.endsWith(suffix)) {
        return Promise.reject(new Error('Directory unreadable'));
      }
      return filesystemIO.readDirectory(path);
    },
  };
}

export function failSource(suffix: string): WorkspaceIO {
  return {
    ...filesystemIO,
    readSource(path) {
      if (path.endsWith(suffix)) {
        return Promise.reject(new Error('Source unreadable'));
      }
      return filesystemIO.readSource(path);
    },
  };
}
