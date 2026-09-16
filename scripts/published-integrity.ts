import { strict as assert } from 'node:assert';

export function assertPublishedIntegrity(value: unknown, expected: string) {
  assert.ok(
    typeof value === 'object' && value !== null && 'dist' in value,
    'Registry response has no distribution metadata'
  );
  const distribution = value.dist;
  assert.ok(
    typeof distribution === 'object' &&
      distribution !== null &&
      'integrity' in distribution,
    'Registry response has no artifact integrity'
  );
  assert.equal(
    distribution.integrity,
    expected,
    'Published version differs from the built artifact; choose a new version'
  );
}
