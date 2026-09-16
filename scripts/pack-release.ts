import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';

import manifest from '../package.json' with { type: 'json' };
import { packWiki } from './package-artifact.ts';

assert.equal(
  process.env['QMD_SNAPSHOT'],
  undefined,
  'Release packages must use the registry QMD dependency'
);
assert.ok(
  Object.values(manifest.dependencies).every((value) =>
    /^(?:\d|npm:)/u.test(value)
  ),
  'Release dependencies must use pinned registry packages'
);
console.log(await packWiki(resolve('.cache/release/agent-wiki')));
