import type { OxlintOverride } from 'oxlint';

type Rules = NonNullable<OxlintOverride['rules']>;

export const lintRules = {
  complexity: [
    'error',
    {
      max: 10,
      variant: 'classic',
    },
  ],
  'max-depth': [
    'error',
    {
      max: 3,
    },
  ],
  'max-lines': [
    'error',
    {
      max: 300,
      skipBlankLines: true,
      skipComments: true,
    },
  ],
  'max-lines-per-function': [
    'error',
    {
      max: 60,
      skipBlankLines: true,
      skipComments: true,
      IIFEs: true,
    },
  ],
  'max-nested-callbacks': [
    'error',
    {
      max: 3,
    },
  ],
  'max-params': [
    'error',
    {
      max: 4,
    },
  ],
  'no-nested-ternary': 'error',
  'no-param-reassign': 'error',
  'require-await': 'off',
  'typescript/ban-ts-comment': [
    'error',
    {
      minimumDescriptionLength: 10,
      'ts-check': false,
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
      'ts-nocheck': true,
    },
  ],
  'typescript/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'never',
    },
  ],
  'typescript/no-confusing-void-expression': 'error',
  'typescript/no-deprecated': 'error',
  'typescript/no-explicit-any': 'error',
  'typescript/no-floating-promises': 'error',
  'typescript/no-misused-promises': 'error',
  'typescript/no-non-null-assertion': 'error',
  'typescript/no-unnecessary-condition': 'error',
  'typescript/no-unnecessary-type-assertion': 'error',
  'typescript/no-unsafe-argument': 'error',
  'typescript/no-unsafe-assignment': 'error',
  'typescript/no-unsafe-call': 'error',
  'typescript/no-unsafe-member-access': 'error',
  'typescript/no-unsafe-return': 'error',
  'typescript/no-unsafe-type-assertion': 'error',
  'typescript/only-throw-error': 'error',
  'typescript/prefer-readonly-parameter-types': 'off',
  'typescript/promise-function-async': 'off',
  'typescript/require-await': 'error',
  'typescript/strict-boolean-expressions': 'error',
  'typescript/switch-exhaustiveness-check': 'error',
  'typescript/use-unknown-in-catch-callback-variable': 'error',
  'import/no-commonjs': [
    'error',
    {
      allowConditionalRequire: false,
      allowPrimitiveModules: false,
      allowRequire: false,
    },
  ],
  'import/no-cycle': 'error',
  'import/no-duplicates': 'error',
  'import/no-namespace': 'error',
  'import/no-unassigned-import': 'error',
  'unicorn/no-abusive-eslint-disable': 'error',
} satisfies Rules;
