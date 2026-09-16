import { expect, test } from 'vitest';

import { assertPublishedIntegrity } from '../scripts/published-integrity.ts';

test('publication retry accepts only the identical immutable artifact', () => {
  expect(() => {
    assertPublishedIntegrity(
      { dist: { integrity: 'sha512-matching' } },
      'sha512-matching'
    );
  }).not.toThrow();
  expect(() => {
    assertPublishedIntegrity(
      { dist: { integrity: 'sha512-different' } },
      'sha512-matching'
    );
  }).toThrow(/choose a new version/u);
});

test('publication retry refuses absent or malformed registry integrity', () => {
  for (const value of [null, {}, 'registry unavailable']) {
    expect(() => {
      assertPublishedIntegrity(value, 'sha512-matching');
    }).toThrow(/no distribution metadata/u);
  }
  for (const dist of [null, {}, 'invalid']) {
    expect(() => {
      assertPublishedIntegrity({ dist }, 'sha512-matching');
    }).toThrow(/no artifact integrity/u);
  }
});
