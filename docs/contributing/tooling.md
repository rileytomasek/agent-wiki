# Agent Wiki Repository Setup and Code Quality

Repository and quality policy for the [Agent Wiki architecture](../design/architecture.md). The [package scripts](../../package.json), [TypeScript configuration](../../tsconfig.json), [Oxlint configuration](../../oxlint.config.ts), and [complete lint rule set](../../tooling/lint-rules.ts) enforce these requirements.

## Repository and runtime

- Start with one TypeScript package containing the reusable library and the `wiki` executable. Use ESM and ship compiled JavaScript plus TypeScript declarations for Node.
- Use Bun for dependency management and package-script invocation. Keep a committed `bun.lock`, frozen CI installs with `bun ci`, the isolated linker, and a 48-hour minimum dependency release age. The exact, checksum-verified first-party QMD snapshot is exempt during its own release; third-party dependencies retain the age requirement.
- Pin a compatible set of Node, Bun, TypeScript, Oxlint, its type-aware engine, Oxfmt, Knip, and test-tool versions. Select the supported Node range together with the actual QMD build; test the minimum supported version and the development version.
- Keep Bun APIs and ambient Bun types out of shipped code. Consumers must not need Bun, Husky, or other development tools to use the package.
- Declare explicit package `exports`, `bin`, `types`, and `files` entries. Use a straightforward TypeScript build; no monorepo, build orchestrator, or release framework is needed initially.
- Maintain a short repository `AGENTS.md` describing the architecture boundaries, commands, and quality policy. Configuration and package scripts remain the executable source of truth.

## Tooling choices

| Area                         | Decision                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Type checking                | TypeScript with the strict checks listed below and Node-compatible module resolution.                               |
| Lint                         | Oxlint with type-aware rules and `oxlint-tsgolint`; enforce all strict rules, including size and complexity limits. |
| Formatting                   | Oxfmt and `.editorconfig`, with the style defined below and import/package sorting.                                 |
| Unused code and dependencies | Knip in both normal and production modes, with strict diagnostics and explicit public entrypoints.                  |
| Tests                        | Vitest running on Node. Bun may invoke the script, but is not the test runtime.                                     |
| Property tests               | `fast-check` with replayable seeds and minimized counterexamples.                                                   |
| Local hooks                  | Husky and lint-staged: staged fixes on commit, full checks before push.                                             |
| CI                           | GitHub Actions with required checks, a reproducible install, and Linux/macOS package verification.                  |

Do not introduce a second formatter or linter alongside Oxfmt/Oxlint. Use Vitest to test behavior on the intended Node runtime.[^vitest]

## TypeScript policy

Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noFallthroughCasesInSwitch`, along with:

- `noImplicitReturns`
- `noImplicitOverride`
- `noPropertyAccessFromIndexSignature`
- `noUnusedLocals`
- `noUnusedParameters`
- `verbatimModuleSyntax`

Use `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and Node types for the package. This checks imports against the runtime that will execute the emitted files, rather than relying on bundler resolution. Keep compiler options aligned with the declared Node runtime and document any build adjustments.[^typescript]

Typecheck source, tests, fixture-building code, scripts, and TypeScript configuration files. A separate build configuration may exclude development files from emitted output, but that exclusion must not remove them from type checking. Produce declarations for the public library and verify them in a temporary consumer project.

## Lint policy

### Uniform size and complexity limits

**Do not relax these rules for tests, fixture builders, configuration files, scripts, or production code.** There are no test-specific size or complexity overrides. Refactor and organize code to comply; do not increase thresholds, add suppressions, or exclude files to evade these limits.

| Rule                     | Required limit                                                       |
| ------------------------ | -------------------------------------------------------------------- |
| `complexity`             | Maximum 10, classic calculation.                                     |
| `max-depth`              | Maximum nesting depth 3.                                             |
| `max-lines`              | Maximum 300 lines per file, excluding blank lines and comments.      |
| `max-lines-per-function` | Maximum 60 lines, excluding blank lines and comments; include IIFEs. |
| `max-nested-callbacks`   | Maximum 3.                                                           |
| `max-params`             | Maximum 4.                                                           |

Enforce `no-nested-ternary`, `no-param-reassign`, and the rest of the configured maintainability rules. The same expectations apply to test setup, assertions, property-test generators, and fixture declarations.[^lint]

### Type safety and correctness

Enable type-aware linting and the correctness, suspicious, pedantic, and performance categories as errors. Enforce rules for:

- Explicit `any`, non-null assertions, unsafe operations and casts, and consistent type assertions.
- Floating/misused promises, asynchronous error handling, throwing Error objects, and unknown catch values.
- Strict boolean expressions, unnecessary conditions, deprecations, and exhaustive switches.
- Type-only imports/exports, explicit library module-boundary types, and immutable exports.
- Circular, duplicate, self, CommonJS, namespace, and unassigned imports where prohibited by the configuration.
- TypeScript suppression comments and unused or abusive lint-disable directives.

Keep intentionally disabled rules as configured in the complete rule set; do not replace the policy with a smaller subset of rules. Lint warnings must fail the quality gate. Enable applicable Vitest lint rules, including detection of focused tests and incorrect asynchronous assertions.

### Architecture boundaries

Enforce import restrictions matching the wiki's modules:

- Library modules cannot depend on CLI modules.
- Parsing and graph logic cannot directly access filesystem/process capabilities; use explicit inputs.
- QMD imports belong in the search adapter.
- Runtime I/O and process behavior belong at the appropriate workspace, adapter, and CLI boundaries.

Keep these restrictions aligned with the architecture. Tests may exercise real I/O through fixtures without inheriting restrictions intended for pure production modules; this does not exempt test code from type-safety, size, complexity, or other maintainability checks.

## Formatting

Use this style: 80-column print width, two spaces, semicolons, single quotes, ES5 trailing commas, sorted imports, and sorted package fields. Retain UTF-8, LF, final newlines, and `.editorconfig`'s treatment of Markdown trailing whitespace.[^format]

Exclude generated output and narrowly identified Markdown/data fixtures whose exact bytes or deliberately malformed syntax are test inputs. This is a formatter exception for fixture data, not a lint exception for test code or TypeScript fixture builders. Ordinary documentation remains formatted.

## Knip

Report errors for unused files, dependencies, development dependencies, exports, types, members, unresolved/unlisted imports, binaries, duplicates, and cycles, with configuration/tag hints treated as errors.[^knip-config]

Run both modes:

- **Normal:** analyze source, tests, tooling, and configuration.
- **Production:** analyze the shipped dependency graph so test-only references cannot conceal unused production helpers.

Declare the public library entrypoint and CLI entrypoint explicitly and map them to source files. Public API exports are intentional entrypoints; do not mark every source file as an entrypoint or add broad ignores to suppress findings. Configure test/fixture scope correctly for production mode while keeping it analyzed in the normal pass.[^knip-production]

## Tests

Run Vitest on Node. Parsing, reference resolution, and moves need explicit behavioral tests for their failure paths and invariants. Focused tests, an unexpectedly empty test suite, or unhandled asynchronous failures must fail checks.

Use these complementary test layers:

| Layer                  | Focus                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and fixture tests | Frontmatter validation, Markdown structure, citations, diagnostics, source positions, filters, and freshness.                         |
| Property tests         | Path normalization/resolution, graph consistency, deterministic projection, and move invariants; preserve reproducible failure seeds. |
| Filesystem integration | Real temporary directories, discovery/root boundaries, cache invalidation, edits/deletions, unreadable files, and partial failures.   |
| QMD integration        | Real temporary SQLite stores, native metadata filters, projection, update/removal behavior, index status, and interrupted runs.       |
| Public API type tests  | Consumer-visible declarations, accepted inputs, rejected inputs, and useful type narrowing.                                           |
| CLI and package tests  | Actual executable behavior, argument handling, JSON/stdout separation, exit codes, and operation outside the checkout.                |

Test CLI logic directly as well as through subprocesses; process-level smoke tests do not replace direct tests of command behavior. Keep routine tests independent of model downloads and external services after dependencies are installed. Run separate embedding/hybrid-search smoke tests when upgrading QMD or changing semantic-search integration. Keep performance benchmarks separate from ordinary correctness gates.

## Package verification

Build a tarball and install it into a fresh temporary consumer project. Verify that:

- The library imports under Node through its declared public exports.
- A consumer TypeScript project can use the emitted declarations.
- The `wiki` executable supports help/version and representative operations from outside the source checkout.
- Packaged files include required runtime resources and omit development-only artifacts.
- Installation and execution do not depend on workspace links, source-checkout paths, Bun globals, or development hook tooling.

Packaging tests create a local artifact; publishing is a separate operation. Repeat the consumer workflows with a fresh Bun install/cache so source-build or lifecycle assumptions cannot leak into Assistant. See the [release guide](releases.md) for publication and registry read-back.

## Scripts, Git hooks, and CI

Keep package scripts as the shared interface for humans, agents, hooks, and CI. Retain familiar names such as `fmt`, `fmt:check`, `lint`, `lint:fix`, `typecheck`, and `knip`; add `knip:production`, `test`, `build`, and `test:package`.

`check` runs formatting verification, lint, type checking, both Knip passes, the normal test suite once, build, and npm/Bun package verification. CI reporter variants may change presentation, not enforced rules.

| Trigger                                 | Required behavior                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pre-commit                              | Husky runs lint-staged, applying supported Oxlint fixes and then Oxfmt to staged files. Preserve sequential execution with `--concurrent false`. |
| Pre-push                                | Husky runs the full `check` command.                                                                                                             |
| Pull requests and default-branch pushes | GitHub Actions runs the required checks using frozen dependencies.                                                                               |
| QMD upgrades or semantic-search changes | Run the additional model-dependent verification separately from routine checks.                                                                  |

Install development hooks through repository setup. They are conveniences and early feedback; required CI checks enforce the same policy when hooks are unavailable or bypassed. These hooks maintain the code repository and are separate from the optional wiki-indexing hooks discussed in the architecture plan.

Use SHA-pinned Actions, read-only workflow permissions, checkout without persisted credentials, frozen installs, explicit timeouts, disabled Husky execution in CI, and cancellation of superseded runs.[^ci]

Run the full quality gate once on the primary Linux/Node environment. Add package/runtime compatibility checks for the minimum supported Node version and the development version across Linux and macOS. Reuse the same underlying scripts without unnecessarily repeating identical checks. Make the CI checks required in the repository's rules.

## Policy changes

Preserve the principle that code must satisfy the quality policy. Do not silently lower thresholds, suppress failures, or narrow analyzed source to make a change pass. Proposed policy changes must be explicit and justified; the agreed size and complexity limits have no test/fixture exceptions.

## Tooling implementation completion criteria

The tooling implementation is complete when the strict configurations, scripts, development hooks, CI workflow, and package smoke test are present; every authored TypeScript area is checked; the full local check passes; and the required CI jobs pass on the declared runtime/platform matrix. A written configuration or a locally installed hook alone is not proof that enforcement works.

## Sources

[^lint]: [Oxlint configuration](../../oxlint.config.ts), [lint rules](../../tooling/lint-rules.ts), and [architecture restrictions](../../tooling/lint-boundaries.ts).

[^typescript]: [TypeScript configuration](../../tsconfig.json) and [TypeScript guidance for compiling to Node](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html).

[^format]: [Oxfmt configuration](../../.oxfmtrc.json) and [EditorConfig](../../.editorconfig).

[^knip-config]: [Knip configuration](../../knip.ts).

[^knip-production]: [Knip production mode](https://knip.dev/features/production-mode), including separation of production and test dependency graphs.

[^vitest]: [Vitest configuration](../../vitest.config.ts).

[^ci]: [CI workflow](../../.github/workflows/ci.yml) and [lint-staged configuration](../../lint-staged.config.ts).
