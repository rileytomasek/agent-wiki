import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { run } from './process.ts';
import { stageSnapshot } from './qmd-package.ts';
import { qmdRelease } from './qmd-release.ts';

async function buildSource(directory: string) {
  const url = `https://github.com/tobi/qmd/archive/${qmdRelease.commit}.tar.gz`;
  const response = await fetch(url);
  assert.ok(response.ok, `QMD source download failed: ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(
    createHash('sha256').update(archive).digest('hex'),
    qmdRelease.sha256
  );
  const archivePath = join(directory, 'source.tgz');
  await writeFile(archivePath, archive);
  const source = join(directory, 'source');
  await mkdir(source);
  run('tar', ['-xzf', archivePath, '--strip-components=1', '-C', source]);
  run(
    'bun',
    ['ci', '--linker', 'isolated', '--minimum-release-age', '172800'],
    {
      cwd: source,
      env: { ...process.env, CI: 'true', HUSKY: '0' },
    }
  );
  return source;
}

const output = resolve(process.argv[2] ?? '.cache/release');
const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-qmd-build-'));
try {
  const source = await buildSource(directory);
  const staging = join(directory, 'package');
  await stageSnapshot(source, staging);
  await mkdir(output, { recursive: true });
  console.log(
    run('npm', ['pack', '--ignore-scripts', '--pack-destination', output], {
      cwd: staging,
    }).trim()
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
