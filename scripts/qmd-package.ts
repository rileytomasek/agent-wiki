import { strict as assert } from 'node:assert';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { qmdRelease } from './qmd-release.ts';

const upstreamUrl = `https://github.com/tobi/qmd/tree/${qmdRelease.commit}`;

export function snapshotManifest(value: unknown) {
  assert.ok(typeof value === 'object' && value !== null);
  assert.ok('name' in value && value.name === '@tobilu/qmd');
  assert.ok('version' in value && value.version === '2.8.3');
  assert.ok('license' in value && value.license === 'MIT');
  assert.ok('peerDependencies' in value);
  assert.deepEqual(value.peerDependencies, { typescript: '^5.9.3' });
  return {
    ...value,
    name: qmdRelease.name,
    version: qmdRelease.version,
    description: `Unofficial prebuilt QMD snapshot (${qmdRelease.commit.slice(0, 7)}) for Agent Wiki`,
    repository: {
      type: 'git',
      url: 'git+https://github.com/rileytomasek/agent-wiki.git',
    },
    homepage: upstreamUrl,
    files: ['bin', 'dist', 'LICENSE', 'README.md', 'UPSTREAM.json'],
    publishConfig: {
      access: 'public',
      registry: 'https://registry.npmjs.org/',
      tag: 'snapshot',
    },
    scripts: undefined,
    devDependencies: undefined,
    peerDependencies: undefined,
    pnpm: undefined,
  };
}

export async function stageSnapshot(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  await Promise.all(
    ['bin', 'dist', 'LICENSE'].map((file) =>
      cp(join(source, file), join(destination, file), { recursive: true })
    )
  );
  const upstream: unknown = JSON.parse(
    await readFile(join(source, 'package.json'), 'utf8')
  );
  await writeFile(
    join(destination, 'package.json'),
    `${JSON.stringify(snapshotManifest(upstream), null, 2)}\n`
  );
  await writeFile(
    join(destination, 'UPSTREAM.json'),
    `${JSON.stringify({ ...qmdRelease, url: upstreamUrl }, null, 2)}\n`
  );
  await writeFile(
    join(destination, 'dist/cli/build-info.json'),
    `${JSON.stringify({ commit: qmdRelease.commit.slice(0, 7) })}\n`
  );
  await copyFile(
    'docs/contributing/qmd-snapshot.md',
    join(destination, 'README.md')
  );
}
