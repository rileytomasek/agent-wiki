import { strict as assert } from 'node:assert';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import manifest from '../package.json' with { type: 'json' };
import { run } from './process.ts';

export async function packWiki(directory: string) {
  await mkdir(directory, { recursive: true });
  const snapshot = process.env['QMD_SNAPSHOT'];
  const cwd = join(directory, 'staging');
  await rm(cwd, { recursive: true, force: true });
  await mkdir(cwd);
  await Promise.all(
    ['dist', 'README.md', 'LICENSE'].map((file) =>
      cp(resolve(file), join(cwd, file), { recursive: true })
    )
  );
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      ...manifest,
      scripts: undefined,
      devDependencies: undefined,
      dependencies: {
        ...manifest.dependencies,
        ...(snapshot === undefined
          ? {}
          : { '@tobilu/qmd': `file:${resolve(snapshot)}` }),
      },
    })
  );
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', directory], {
    cwd,
  });
  const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
  const artifact = join(directory, filename);
  const files = run('tar', ['-tzf', artifact]).trim().split('\n');
  assert.ok(files.includes('package/dist/index.d.ts'));
  assert.ok(files.includes('package/dist/cli/bin.js'));
  assert.ok(files.includes('package/LICENSE'));
  assert.ok(
    files.every((file) =>
      /^package\/(?:dist\/|README\.md$|LICENSE$|package\.json$)/u.test(file)
    )
  );
  return artifact;
}
