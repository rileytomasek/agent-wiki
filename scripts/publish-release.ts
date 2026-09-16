import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import manifest from '../package.json' with { type: 'json' };
import { run } from './process.ts';
import { assertPublishedIntegrity } from './published-integrity.ts';
import { qmdRelease } from './qmd-release.ts';

const snapshot = process.argv.includes('--qmd');
const selected = snapshot ? qmdRelease : manifest;
const filename = `${selected.name.replace('@', '').replace('/', '-')}-${selected.version}.tgz`;
const directory = snapshot ? 'qmd' : 'agent-wiki';
const artifact = resolve('.cache/release', directory, filename);
const bytes = await readFile(artifact);
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const url = `https://registry.npmjs.org/${encodeURIComponent(selected.name)}/${selected.version}`;
const response = await fetch(url);
if (response.status === 404) {
  console.log(
    run('npm', [
      'publish',
      artifact,
      '--ignore-scripts',
      '--access',
      'public',
      '--tag',
      snapshot ? 'snapshot' : 'latest',
    ])
  );
} else {
  assert.ok(response.ok, `Registry lookup failed: ${response.status}`);
  const published: unknown = await response.json();
  assertPublishedIntegrity(published, integrity);
  console.log(
    `${selected.name}@${selected.version} already has this exact artifact`
  );
}
