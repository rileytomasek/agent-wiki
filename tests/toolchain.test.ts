import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

test('mise and the SDK resolve the same immutable QMD revision', async () => {
  const [mise, manifest, lock] = await Promise.all([
    readFile('mise.toml', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('bun.lock', 'utf8'),
  ]);
  const revision = /\[tools\."http:qmd"\]\s+version = "([a-f0-9]{40})"/u.exec(
    mise
  )?.[1];
  expect(revision).toBeDefined();
  expect(manifest).toContain(`git+https://github.com/tobi/qmd.git#${revision}`);
  expect(lock).toContain(`git+https://github.com/tobi/qmd.git#${revision}`);
});
