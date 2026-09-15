import type { Configuration } from 'lint-staged';

const config = {
  '*.{cjs,js,jsx,mjs,ts,tsx}':
    'oxlint --fix --deny-warnings --report-unused-disable-directives',
  '*': 'oxfmt --no-error-on-unmatched-pattern',
} satisfies Configuration;

export default config;
