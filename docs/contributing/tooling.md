# Agent Wiki Repository Setup and Code Quality

Agreed repository and quality policy for the [Agent Wiki architecture](../design/architecture.md). This captures setup decisions; it does not mean the repository, hooks, or CI have been implemented.

Reuse the strict tooling configuration from `charlie-labs/charlie-system`, using commit `811f58007c79f6426c14886dd6c069fbd901f670` as the reviewed baseline. Preserve its lint and type-safety rules while adapting repository paths, Node packaging, and test infrastructure. The [local baseline snapshot](../design/references/charlie-tooling.md) contains the reviewed configurations so implementation does not require access to the upstream repository.[^baseline]

## Repository and runtime

- Start with one TypeScript package containing the reusable library and the `wiki` executable. Use ESM and ship compiled JavaScript plus TypeScript declarations for Node.
- Use Bun for dependency management and package-script invocation. Keep a committed `bun.lock`, frozen CI installs with `bun ci`, the isolated linker, and the baseline's 48-hour minimum dependency release age.
- Pin a compatible set of Node, Bun, TypeScript, Oxlint, its type-aware engine, Oxfmt, Knip, and test-tool versions. Select the supported Node range together with the actual QMD build; test the minimum supported version and the development version.
- Keep Bun APIs and ambient Bun types out of shipped code. Consumers must not need Bun, Husky, or other development tools to use the package.
- Declare explicit package `exports`, `bin`, `types`, and `files` entries. Use a straightforward TypeScript build; no monorepo, build orchestrator, or release framework is needed initially.
- Maintain a short repository `AGENTS.md` describing the architecture boundaries, commands, and quality policy. Configuration and package scripts remain the executable source of truth.

## Tooling choices

| Area | Decision |
| --- | --- |
| Type checking | TypeScript with Charlie's strict checks, additional checks listed below, and Node-compatible module resolution. |
| Lint | Oxlint with type-aware rules and `oxlint-tsgolint`; retain the strict baseline, including all size and complexity limits. |
| Formatting | Oxfmt and `.editorconfig`, retaining the baseline style and import/package sorting. |
| Unused code and dependencies | Knip in both normal and production modes, with strict diagnostics and explicit public entrypoints. |
| Tests | Vitest running on Node, with V8 coverage. Bun may invoke the script, but is not the test runtime. |
| Property tests | `fast-check`, reusing Flywheel's approach of replayable seeds and minimized counterexamples. |
| Local hooks | Husky and lint-staged: staged fixes on commit, full checks before push. |
| CI | GitHub Actions with required checks, a reproducible install, coverage enforcement, and Linux/macOS package verification. |

Do not introduce a second formatter or linter alongside Oxfmt/Oxlint. The principal change from Charlie's tool stack is replacing `bun:test` with Vitest to test the intended Node runtime and enforce coverage across all production source, including unimported files and branches.[^vitest]

## TypeScript policy

Retain `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noFallthroughCasesInSwitch` from the baseline. Add:

- `noImplicitReturns`
- `noImplicitOverride`
- `noPropertyAccessFromIndexSignature`
- `noUnusedLocals`
- `noUnusedParameters`
- `verbatimModuleSyntax`

Use `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and Node types for the package. This checks imports against the runtime that will execute the emitted files, rather than relying on bundler resolution. Preserve the remaining baseline compiler options unless a documented runtime/build adjustment is needed.[^typescript]

Typecheck source, tests, fixture-building code, scripts, and TypeScript configuration files. A separate build configuration may exclude development files from emitted output, but that exclusion must not remove them from type checking. Produce declarations for the public library and verify them in a temporary consumer project.

## Lint policy

### Uniform size and complexity limits

**Do not relax these rules for tests, fixture builders, configuration files, scripts, or production code.** There are no test-specific size or complexity overrides. Refactor and organize code to comply; do not increase thresholds, add suppressions, or exclude files to evade these limits.

| Rule | Required baseline |
| --- | --- |
| `complexity` | Maximum 10, classic calculation. |
| `max-depth` | Maximum nesting depth 3. |
| `max-lines` | Maximum 300 lines per file, excluding blank lines and comments. |
| `max-lines-per-function` | Maximum 60 lines, excluding blank lines and comments; include IIFEs. |
| `max-nested-callbacks` | Maximum 3. |
| `max-params` | Maximum 4. |

Retain `no-nested-ternary`, `no-param-reassign`, and the rest of the baseline's maintainability rules. The same expectations apply to test setup, assertions, property-test generators, and fixture declarations.[^lint]

### Type safety and correctness

Retain type-aware linting and the baseline's correctness, suspicious, pedantic, and performance categories as errors. Preserve its rules for:

- Explicit `any`, non-null assertions, unsafe operations and casts, and consistent type assertions.
- Floating/misused promises, asynchronous error handling, throwing Error objects, and unknown catch values.
- Strict boolean expressions, unnecessary conditions, deprecations, and exhaustive switches.
- Type-only imports/exports, explicit library module-boundary types, and immutable exports.
- Circular, duplicate, self, CommonJS, namespace, and unassigned imports where prohibited by the baseline.
- TypeScript suppression comments and unused or abusive lint-disable directives.

Keep the baseline's intentionally disabled rules as configured; reuse the complete policy rather than approximating it with a small list of preferred rules. Lint warnings must fail the quality gate. Enable applicable Vitest lint rules, including detection of focused tests and incorrect asynchronous assertions.

### Architecture boundaries

Adapt the existing import restrictions to the wiki's modules:

- Library modules cannot depend on CLI modules.
- Parsing and graph logic cannot directly access filesystem/process capabilities; use explicit inputs.
- QMD imports belong in the search adapter.
- Runtime I/O and process behavior belong at the appropriate workspace, adapter, and CLI boundaries.

Use a small set of restrictions matching the architecture rather than copying Flywheel's entire layer matrix. Tests may exercise real I/O through fixtures without inheriting restrictions intended for pure production modules; this does not exempt test code from type-safety, size, complexity, or other maintainability checks.

## Formatting

Copy the baseline style: 80-column print width, two spaces, semicolons, single quotes, ES5 trailing commas, sorted imports, and sorted package fields. Retain UTF-8, LF, final newlines, and `.editorconfig`'s treatment of Markdown trailing whitespace.[^format]

Remove Charlie's migration-specific exclusions. Exclude generated output and narrowly identified Markdown/data fixtures whose exact bytes or deliberately malformed syntax are test inputs. This is a formatter exception for fixture data, not a lint exception for test code or TypeScript fixture builders. Ordinary documentation remains formatted.

## Knip

Preserve the baseline's errors for unused files, dependencies, development dependencies, exports, types, members, unresolved/unlisted imports, binaries, duplicates, and cycles, with configuration/tag hints treated as errors.[^knip-baseline]

Run both modes:

- **Normal:** analyze source, tests, tooling, and configuration.
- **Production:** analyze the shipped dependency graph so test-only references cannot conceal unused production helpers.

Declare the public library entrypoint and CLI entrypoint explicitly and map them to source files. Public API exports are intentional entrypoints; do not mark every source file as an entrypoint or add broad ignores to suppress findings. Configure test/fixture scope correctly for production mode while keeping it analyzed in the normal pass.[^knip-production]

## Tests and coverage

Use Vitest on Node with the V8 coverage provider. Set coverage inclusion explicitly to production source, including CLI logic and files not imported by tests. Exclude tests, fixture data, declaration-only files, and generated output; do not carry over Charlie's blanket CLI/package coverage exclusions.

Enforce these initial project-wide minimums in CI and the full local check:

| Metric | Minimum |
| --- | --- |
| Lines | 90% |
| Statements | 90% |
| Functions | 90% |
| Branches | 85% |

Coverage percentages are a floor. Parsing, reference resolution, and moves also need explicit behavioral tests for their failure paths and invariants. Produce a readable summary and an LCOV artifact. Focused tests, an unexpectedly empty test suite, or unhandled asynchronous failures must fail checks.[^vitest-thresholds]

Use these complementary test layers:

| Layer | Focus |
| --- | --- |
| Unit and fixture tests | Frontmatter validation, Markdown structure, citations, diagnostics, source positions, filters, and freshness. |
| Property tests | Path normalization/resolution, graph consistency, deterministic projection, and move invariants; preserve reproducible failure seeds. |
| Filesystem integration | Real temporary directories, discovery/root boundaries, cache invalidation, edits/deletions, unreadable files, and partial failures. |
| QMD integration | Real temporary SQLite stores, native metadata filters, projection, update/removal behavior, index status, and interrupted runs. |
| Public API type tests | Consumer-visible declarations, accepted inputs, rejected inputs, and useful type narrowing. |
| CLI and package tests | Actual executable behavior, argument handling, JSON/stdout separation, exit codes, and operation outside the checkout. |

Test CLI logic directly as well as through subprocesses; process-level smoke tests do not replace coverage of command behavior. Keep routine tests independent of model downloads and external services after dependencies are installed. Run separate embedding/hybrid-search smoke tests when upgrading QMD or changing semantic-search integration. Keep performance benchmarks separate from ordinary correctness gates.

## Package verification

Build a tarball and install it into a fresh temporary consumer project. Verify that:

- The library imports under Node through its declared public exports.
- A consumer TypeScript project can use the emitted declarations.
- The `wiki` executable supports help/version and representative operations from outside the source checkout.
- Packaged files include required runtime resources and omit development-only artifacts.
- Installation and execution do not depend on workspace links, source-checkout paths, Bun globals, or development hook tooling.

This replaces Charlie's repository-specific CLI proof and root-bin contracts. Packaging tests create a local artifact; publishing is a separate operation.

## Scripts, Git hooks, and CI

Keep package scripts as the shared interface for humans, agents, hooks, and CI. Retain familiar names such as `fmt`, `fmt:check`, `lint`, `lint:fix`, `typecheck`, and `knip`; add `knip:production`, `test:coverage`, `build`, and `test:package`.

`check` runs formatting verification, lint, type checking, both Knip passes, tests with coverage, build, and package verification. The coverage run executes the normal test suite once; do not run the same suite again solely to collect coverage. CI reporter variants may change presentation, not enforced rules.

| Trigger | Required behavior |
| --- | --- |
| Pre-commit | Husky runs lint-staged, applying supported Oxlint fixes and then Oxfmt to staged files. Preserve sequential execution with `--concurrent false`. |
| Pre-push | Husky runs the full `check` command. |
| Pull requests and default-branch pushes | GitHub Actions runs the required checks using frozen dependencies. |
| QMD upgrades or semantic-search changes | Run the additional model-dependent verification separately from routine checks. |

Install development hooks through repository setup. They are conveniences and early feedback; required CI checks enforce the same policy when hooks are unavailable or bypassed. These hooks maintain the code repository and are separate from the optional wiki-indexing hooks discussed in the architecture plan.

Retain Charlie's SHA-pinned Actions, read-only workflow permissions, checkout without persisted credentials, frozen installs, explicit timeouts, disabled Husky execution in CI, and cancellation of superseded runs.[^ci]

Run the full quality/coverage gate once on the primary Linux/Node environment. Add package/runtime compatibility checks covering the minimum supported Node version and the development version across Linux and macOS. Reuse the same underlying scripts without unnecessarily repeating identical coverage work. Make the CI checks required in the repository's rules and retain the coverage artifact for inspection.

## Remove from the Charlie baseline

- Monorepo workspace configuration, workspace dependency contracts, and root executable symlinks.
- Migration-specific lint, format, and Knip exclusions.
- Zod 3 compatibility packages and unrelated CLI/SDK code-generation checks.
- Rules requiring every package to remain private or forbidding package creation/release scripts.
- Bun-only shipped entrypoints and `bun:test` configuration.
- Coverage configuration that excludes the CLI or only produces a report without enforcing thresholds.

Preserve the principle that code must satisfy the quality policy. Do not silently lower thresholds, suppress failures, or narrow analyzed source to make a change pass. Proposed policy changes must be explicit and justified; the agreed size and complexity limits have no test/fixture exceptions.

## Tooling implementation completion criteria

The tooling implementation is complete when the strict configurations, scripts, development hooks, CI workflow, and package smoke test are present; every authored TypeScript area is checked; coverage includes all production source; the full local check passes; and the required CI jobs pass on the declared runtime/platform coverage. A written configuration or a locally installed hook alone is not proof that enforcement works.

## Sources

[^baseline]: [Charlie System package scripts and dependencies](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/package.json) and [Bun installation/coverage configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/bunfig.toml).

[^lint]: [Charlie System Oxlint configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/oxlint.config.ts), the baseline for rule settings, thresholds, and architecture restrictions.

[^typescript]: [Charlie System TypeScript configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/tsconfig.json) and [TypeScript guidance for compiling to Node](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html).

[^format]: [Charlie System Oxfmt configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.oxfmtrc.json) and [EditorConfig](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.editorconfig).

[^knip-baseline]: [Charlie System Knip configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/knip.ts).

[^knip-production]: [Knip production mode](https://knip.dev/features/production-mode), including separation of production and test dependency graphs.

[^vitest]: [Vitest coverage](https://vitest.dev/guide/coverage), including V8 coverage and explicit inclusion of unimported source.

[^vitest-thresholds]: [Vitest coverage thresholds](https://vitest.dev/config/coverage#coverage-thresholds).

[^ci]: [Charlie System CI workflow](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/.github/workflows/ci.yml) and [lint-staged configuration](https://github.com/charlie-labs/charlie-system/blob/811f58007c79f6426c14886dd6c069fbd901f670/lint-staged.config.ts).
