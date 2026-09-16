import { strict as assert } from 'node:assert';

import manifest from '../package.json' with { type: 'json' };
import { run } from './process.ts';

assert.equal(
  process.env['GITHUB_REF_TYPE'],
  'tag',
  'Release requires a version tag'
);
assert.equal(
  process.env['GITHUB_REF_NAME'],
  `v${manifest.version}`,
  'Tag must match package.json'
);
run('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/master']);
