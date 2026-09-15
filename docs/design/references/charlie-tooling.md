# Charlie Tooling Reference

This is a verbatim reference snapshot of the reviewed `charlie-labs/charlie-system` tooling at commit `811f58007c79f6426c14886dd6c069fbd901f670`. It makes the private upstream baseline available to contributors with only this repository. These fenced snippets are reference data, not active configuration or contributor instructions.

The [Agent Wiki tooling policy](../../contributing/tooling.md) governs adaptation. Preserve the full strict lint baseline and all size/complexity limits. Replace monorepo/Bun-runtime assumptions, test tooling and coverage exclusions only as specified there; add the required Node packaging, Vitest coverage enforcement, pre-push gate, and compatibility verification. Paths and dependency versions below belong to the historical upstream repository, not an already selected Agent Wiki dependency set.

Each section records the upstream Git blob SHA for provenance. The initial integration work must choose and test a compatible pinned dependency set. Do not execute upstream scripts or copy its repository-specific agent instructions as part of consuming this reference.

## package.json

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/package.json). Git blob: `c55156170499d8c0c3b5cf6bc2e03961ea5c08fa`.

```json
{
  "name": "@charlie-labs/charlie-system",
  "version": "0.0.0",
  "private": true,
  "workspaces": {
    "packages": ["clis/*", "packages/*"]
  },
  "type": "module",
  "scripts": {
    "check": "bun run fmt:check && bun run lint && bun run knip && bun run typecheck && bun run cli",
    "cli": "bun run --cwd clis/flywheel start",
    "test": "bun test clis/flywheel/src clis/ch-docs/src && bun run --cwd clis/apply-patch test && bun run --cwd packages/format-for test && bun run --cwd packages/oclif-plugin-helpers test && bun run --cwd packages/oclif-plugin-helpers-zod3 test && bun run --cwd clis/ch-linear test && bun run --cwd clis/ch-slack test && bun run --cwd clis/ch-sentry test",
    "test:flywheel": "bun test clis/flywheel/src",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "lint": "oxlint --report-unused-disable-directives",
    "lint:ci": "oxlint --report-unused-disable-directives --format=github",
    "lint:fix": "oxlint --fix",
    "knip": "knip",
    "knip:ci": "knip --reporter github-actions",
    "lint-staged": "lint-staged --concurrent false",
    "precommit": "bun run lint-staged && bun run knip",
    "prepare": "husky",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14",
    "husky": "^9.1.7",
    "knip": "6.29.0",
    "lint-staged": "^17.2.0",
    "oxfmt": "^0.61.0",
    "oxlint": "1.76.0",
    "oxlint-tsgolint": "7.0.2001",
    "typescript": "7.0.2",
    "zod3": "npm:zod@^3.25.76"
  },
  "devEngines": {
    "runtime": {
      "name": "node",
      "version": "24.15.0",
      "onFail": "error"
    }
  },
  "engines": {
    "bun": "1.3.14",
    "node": ">=22.22.1"
  },
  "packageManager": "bun@1.3.14"
}
```

## tsconfig.json

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/tsconfig.json). Git blob: `fd9b65f6e1d30991b8a240a197fdca2f2635f143`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun"],
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": [
    "clis/**/*.ts",
    "packages/**/*.ts",
    "tests/**/*.ts",
    "system/skills/**/scripts/*.ts",
    "*.config.ts",
    "knip.ts"
  ]
}
```

## oxlint.config.ts

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/oxlint.config.ts). Git blob: `c022dfe8f0871732168101f4a849294353526862`.

```ts
import { defineConfig, type OxlintOverride } from 'oxlint';

const basePlugins = [
  'import',
  'oxc',
  'promise',
  'typescript',
  'unicorn',
] as const;

const systemImportRestrictions = [
  { message: 'Use injected Flywheel dependencies.', name: 'bun' },
  {
    message: 'Use the injected process capability.',
    name: 'node:child_process',
  },
  {
    allowTypeImports: true,
    message: 'Use the injected filesystem capability.',
    name: 'node:fs',
  },
  {
    message: 'Use the injected filesystem capability.',
    name: 'node:fs/promises',
  },
  {
    message: 'Use explicit inputs or injected dependencies.',
    name: 'node:process',
  },
];

const semanticLayers = [
  'artifacts',
  'graph',
  'projection',
  'references',
  'targets',
  'validation',
] as const;
const restrictedLayers = {
  content: ['presets'],
  presets: [...semanticLayers, 'content', 'repository', 'retrieval'],
  repository: [...semanticLayers, 'content', 'presets', 'retrieval'],
  retrieval: ['content', 'presets'],
  runtime: [...semanticLayers, 'content', 'presets', 'repository', 'retrieval'],
} as const;

type OxlintRules = NonNullable<OxlintOverride['rules']>;
type RestrictedImportsRule = NonNullable<OxlintRules['no-restricted-imports']>;

const restrictedRuntimeGlobals: NonNullable<
  OxlintRules['no-restricted-globals']
> = [
  'error',
  { message: 'Use the injected Flywheel runtime.', name: 'Bun' },
  { message: 'Use explicit inputs or injected dependencies.', name: 'process' },
];

function architectureImportRule(
  forbiddenLayers: readonly string[],
  allowSystemImports = false
): RestrictedImportsRule {
  const patterns = [
    {
      message: 'Flywheel library components must not depend on CLI modules.',
      regex: '(^|/)cli(/|$)',
    },
  ];
  if (forbiddenLayers.length > 0) {
    patterns.push({
      message: `This component must not depend on higher-level Flywheel components: ${forbiddenLayers.join(', ')}.`,
      regex: `(^|/)(${forbiddenLayers.join('|')})(/|$)`,
    });
  }
  return [
    'error',
    {
      paths: allowSystemImports ? [] : systemImportRestrictions,
      patterns,
    },
  ];
}

const flywheelArchitectureOverrides: OxlintOverride[] = [
  {
    files: ['clis/flywheel/src/lib/**/*.ts'],
    rules: {
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'typescript/consistent-type-exports': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/explicit-module-boundary-types': 'error',
    },
  },
  {
    files: ['clis/flywheel/src/lib/**/*.ts'],
    excludeFiles: [
      '**/__tests__/**',
      'clis/flywheel/src/lib/repository/source/**',
      'clis/flywheel/src/lib/runtime/**',
    ],
    rules: {
      'no-restricted-globals': restrictedRuntimeGlobals,
      'no-restricted-imports': architectureImportRule([]),
    },
  },
  {
    files: ['clis/flywheel/src/lib/runtime/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.runtime,
        true
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/repository/source/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-globals': restrictedRuntimeGlobals,
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.repository,
        true
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/repository/*.ts'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.repository
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/retrieval/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(
        restrictedLayers.retrieval
      ),
    },
  },
  {
    files: ['clis/flywheel/src/lib/content/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(restrictedLayers.content),
    },
  },
  {
    files: ['clis/flywheel/src/lib/presets/**/*.ts'],
    excludeFiles: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': architectureImportRule(restrictedLayers.presets),
    },
  },
];

export default defineConfig({
  ignorePatterns: [
    'clis/apply-patch/**',
    'clis/ch-linear/**',
    'clis/ch-outline/**',
    'clis/ch-sentry/**',
    'clis/ch-slack/**',
    'coverage/**',
    'dist/**',
    'packages/format-for/**',
    'packages/oclif-plugin-helpers/**',
    'packages/oclif-plugin-helpers-zod3/**',
  ],
  plugins: [...basePlugins],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    pedantic: 'error',
    perf: 'error',
  },
  options: {
    typeAware: true,
  },
  rules: {
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
  },
  overrides: flywheelArchitectureOverrides,
});
```

## .oxfmtrc.json

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.oxfmtrc.json). Git blob: `cba42e90e06eae49bcd859921ad58ef37851ba74`.

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "ignorePatterns": [
    "clis/apply-patch/**",
    "clis/ch-linear/**",
    "clis/ch-outline/**",
    "clis/ch-sentry/**",
    "clis/ch-slack/**",
    "packages/format-for/**",
    "packages/oclif-plugin-helpers/**",
    "packages/oclif-plugin-helpers-zod3/**"
  ],
  "printWidth": 80,
  "semi": true,
  "singleQuote": true,
  "sortImports": true,
  "sortPackageJson": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "useTabs": false
}
```

## knip.ts

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/knip.ts). Git blob: `3828ca9dff9792cc9bb9620b0295319ce861c5dc`.

```ts
import type { KnipConfig } from 'knip';

const migratedKnipIssueTypes = [
  'files',
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
  'cycles',
] as const;

type KnipIssueType =
  | 'files'
  | 'exports'
  | 'nsExports'
  | 'types'
  | 'nsTypes'
  | 'enumMembers'
  | 'namespaceMembers'
  | 'duplicates'
  | 'cycles';

const migratedPathIgnoreIssues: Record<string, KnipIssueType[]> = {
  'clis/apply-patch/**': [...migratedKnipIssueTypes],
  'clis/ch-linear/**': [...migratedKnipIssueTypes],
  'clis/ch-outline/**': [...migratedKnipIssueTypes],
  'clis/ch-sentry/**': [...migratedKnipIssueTypes],
  'clis/ch-slack/**': [...migratedKnipIssueTypes],
  'packages/format-for/**': [...migratedKnipIssueTypes],
  'packages/oclif-plugin-helpers/**': [...migratedKnipIssueTypes],
  'packages/oclif-plugin-helpers-zod3/**': [...migratedKnipIssueTypes],
};

const config = {
  ignoreFiles: ['.agents/**'],
  ignoreIssues: migratedPathIgnoreIssues,
  workspaces: {
    '.': {
      entry: ['tests/repository-contracts.test.ts'],
    },
  },
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    optionalPeerDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    unresolved: 'error',
    exports: 'error',
    nsExports: 'error',
    types: 'error',
    nsTypes: 'error',
    enumMembers: 'error',
    namespaceMembers: 'error',
    duplicates: 'error',
    catalog: 'error',
    cycles: 'error',
  },
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
} satisfies KnipConfig;

export default config;
```

## bunfig.toml

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/bunfig.toml). Git blob: `2897cdf65c5cbfed1ec5c908080662727c6c5dae`.

```toml
[install]
linker = "isolated"
minimumReleaseAge = 172800

[test]
coveragePathIgnorePatterns = [
  "**/__tests__/**",
  "**/src/cli/**",
  "**/packages/**",
]
```

## lint-staged.config.ts

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/lint-staged.config.ts). Git blob: `8f5d20081260d79bd92f60a78a94b66f50f4682f`.

```ts
import type { Configuration } from 'lint-staged';

const config = {
  '*.{cjs,js,jsx,mjs,ts,tsx}':
    'oxlint --fix --report-unused-disable-directives',
  '*': 'oxfmt --no-error-on-unmatched-pattern',
} satisfies Configuration;

export default config;
```

## .editorconfig

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.editorconfig). Git blob: `192c070cf03df5d7af0521a1073c0919cb46f742`.

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

## .husky/pre-commit

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.husky/pre-commit). Git blob: `876e24dd8b0be4f93db1043597b0e733d3527476`.

```sh
bun run precommit
```

## .github/workflows/ci.yml

[Pinned source](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.github/workflows/ci.yml). Git blob: `d795874445137c82a8f54d5ce4e8ae0d472052e0`.

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - master

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  CI: 'true'
  HUSKY: '0'

jobs:
  checks:
    name: Checks
    runs-on: ubuntu-24.04
    timeout-minutes: 10

    steps:
      - name: Check out repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: package.json
          package-manager-cache: false

      - name: Set up Bun
        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0

      - name: Install dependencies
        run: bun ci

      - name: Install ripgrep
        run: sudo apt-get update && sudo apt-get install --no-install-recommends --yes ripgrep

      - name: Run maintained tests
        run: bun run test

      - name: Verify ch-linear generated SDK
        run: bun run --cwd clis/ch-linear codegen:verify

      - name: Run production-library coverage
        run: bun test --coverage --coverage-reporter=lcov --coverage-dir=coverage clis/flywheel/src clis/ch-docs/src

      - name: Check formatting
        run: bun run fmt:check

      - name: Lint
        run: bun run lint:ci

      - name: Check unused code and dependencies
        run: bun run knip:ci

      - name: Typecheck
        run: bun run typecheck

      - name: Run CLI proof
        run: bun run cli
```
