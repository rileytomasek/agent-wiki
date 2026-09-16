import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function command(root: string, args: readonly string[], status = 0) {
  const result = spawnSync(
    resolve('node_modules/.bin/wiki'),
    [...args, '--root', root, '--json'],
    { encoding: 'utf8', timeout: 30_000 }
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  const value: unknown = JSON.parse(result.stdout);
  assert.ok(typeof value === 'object' && value !== null);
  return value;
}

const root = resolve('wiki');
assert.ok('content' in command(root, ['show', 'notes.md']));
const listing = command(root, ['list', '--type', 'doc/guide', '--limit', '1']);
assert.ok('total' in listing);
assert.equal(listing.total, 1);
assert.ok('relationships' in command(root, ['related', 'notes.md']));
const validation = command(root, ['validate', '*.md']);
assert.ok('valid' in validation);
assert.equal(validation.valid, true);
const status = command(root, ['status']);
assert.ok('availability' in status);
assert.equal(status.availability, 'absent');
const missing = command(root, ['search', 'orchid'], 1);
assert.ok('diagnostics' in missing);
assert.match(JSON.stringify(missing.diagnostics), /search.index-missing/u);
const preview = command(root, [
  'move',
  'notes.md',
  'archive/notes.md',
  '--dry-run',
]);
assert.ok('plan' in preview);
command(root, ['move', 'notes.md', 'archive/notes.md']);
assert.ok('content' in command(root, ['show', 'archive/notes.md']));
const empty = resolve('empty-wiki');
await mkdir(empty);
command(empty, ['index']);
const indexed = command(empty, ['status']);
assert.ok('status' in indexed);
assert.equal(indexed.status, 'current');
console.log(
  `Node ${process.version}: all eight packaged CLI commands exercised`
);
