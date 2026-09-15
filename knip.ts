import type { KnipConfig } from 'knip';

const config = {
  entry: [
    'src/index.ts!',
    'src/cli/bin.ts!',
    'tests/consumer/*.ts',
    'tests/fixtures/deny-qmd.ts',
  ],
  project: [
    'src/**/*.ts!',
    'tests/**/*.ts',
    'scripts/**/*.ts',
    'tooling/**/*.ts',
    '*.ts',
  ],
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
