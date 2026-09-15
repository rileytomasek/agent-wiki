import type { OxlintOverride } from 'oxlint';

export const boundaries: OxlintOverride[] = [
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'Bun'],
      'no-restricted-imports': ['error', { patterns: ['bun', 'bun:*'] }],
    },
  },
  {
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['bun', 'bun:*', '@tobilu/qmd', '@tobilu/qmd/**'] },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    excludeFiles: ['src/cli/**', 'src/search/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'bun',
            'bun:*',
            '@tobilu/qmd',
            '@tobilu/qmd/**',
            '**/cli/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/search/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['bun', 'bun:*', '**/cli/**', '@tobilu/qmd/**'] },
      ],
    },
  },
  {
    files: ['src/documents/**/*.ts', 'src/references/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'Bun', 'process'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'bun',
            'bun:*',
            '@tobilu/qmd',
            '@tobilu/qmd/**',
            '**/cli/**',
            'node:fs',
            'node:fs/*',
            'fs',
            'fs/*',
            'node:process',
            'process',
            'node:child_process',
            'child_process',
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    excludeFiles: ['src/cli/**'],
    rules: {
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'typescript/consistent-type-exports': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/explicit-module-boundary-types': 'error',
    },
  },
  {
    files: ['tests/**/*.test.ts'],
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/valid-expect': 'error',
      'vitest/valid-describe-callback': 'error',
      'vitest/no-identical-title': 'error',
    },
  },
];
