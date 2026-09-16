import { defineConfig } from 'oxlint';

import { boundaries } from './tooling/lint-boundaries.ts';
import { lintRules } from './tooling/lint-rules.ts';

export default defineConfig({
  ignorePatterns: ['dist/**', '.cache/**'],
  plugins: ['import', 'oxc', 'promise', 'typescript', 'unicorn', 'vitest'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    pedantic: 'error',
    perf: 'error',
  },
  options: { typeAware: true },
  rules: lintRules,
  overrides: boundaries,
});
