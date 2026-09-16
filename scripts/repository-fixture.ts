import { cp, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { run } from './process.ts';

export async function copyRepository(directory: string) {
  const files = run('git', [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  await Promise.all(
    files
      .split('\0')
      .filter(Boolean)
      .map((file) =>
        cp(resolve(file), join(directory, file), { recursive: true })
      )
  );
  await symlink(
    resolve('node_modules'),
    join(directory, 'node_modules'),
    'dir'
  );
}
