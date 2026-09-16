import { expect, test } from 'vitest';

import { snapshotManifest } from '../scripts/qmd-package.ts';
import { qmdRelease } from '../scripts/qmd-release.ts';

const upstream = {
  name: '@tobilu/qmd',
  version: '2.8.3',
  license: 'MIT',
  author: 'Upstream author',
  dependencies: { 'native-module': '1.2.3' },
  optionalDependencies: { 'platform-module': '4.5.6' },
  peerDependencies: { typescript: '^5.9.3' },
  devDependencies: { typescript: '5.9.3' },
  scripts: { prepare: 'build source' },
};

test('snapshot retains native dependencies and attribution without consumer builds', () => {
  const manifest: unknown = JSON.parse(
    JSON.stringify(snapshotManifest(upstream))
  );
  expect(manifest).toMatchObject({
    name: qmdRelease.name,
    version: qmdRelease.version,
    license: 'MIT',
    author: upstream.author,
    dependencies: upstream.dependencies,
    optionalDependencies: upstream.optionalDependencies,
  });
  expect(manifest).not.toHaveProperty('scripts');
  expect(manifest).not.toHaveProperty('devDependencies');
  expect(manifest).not.toHaveProperty('peerDependencies');
});

test('snapshot refuses an unexpected upstream package or new peer requirement', () => {
  expect(() => snapshotManifest(null)).toThrow(/./u);
  expect(() =>
    snapshotManifest({ ...upstream, name: 'another-package' })
  ).toThrow(/./u);
  expect(() => snapshotManifest({ ...upstream, version: '3.0.0' })).toThrow(
    /./u
  );
  expect(() => snapshotManifest({ ...upstream, license: 'different' })).toThrow(
    /./u
  );
  expect(() => snapshotManifest({ ...upstream, peerDependencies: {} })).toThrow(
    /./u
  );
});
