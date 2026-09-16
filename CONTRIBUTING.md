# Contributing

Read the [README](README.md) for current availability. Find or claim the relevant
issue in the [Linear project](https://linear.app/tomasekio/project/agent-wiki-fc8efac8c2ef)
before implementation. Keep scope, dependencies, acceptance criteria, and progress
there; keep technical decisions in the repository.

## Understand the contract

Read the [document format](docs/design/document-format.md),
[CLI specification](docs/design/cli-spec.md), and
[architecture](docs/design/architecture.md). Use the
[implementation plan](docs/design/implementation-plan.md) for integration order
and [conformance scenarios](docs/design/conformance.md) for expected behavior.

The format and CLI specifications govern observable behavior. Architecture governs
component responsibilities; its internal names and interface sketches are
illustrative. The [tooling policy](docs/contributing/tooling.md) governs engineering
quality. User guides and examples explain those contracts without redefining them.
Resolve a genuine conflict in the relevant specification before building an
incompatible behavior.

## Development workflow

Follow the [development setup](README.md#development-setup), then use package
scripts as the shared interface for local work and CI. `bun run check` performs
format, lint, type, both Knip, test, build, and npm/Bun package-consumer checks.
`bun run test:tooling` and `bun run test:hooks` verify enforcement using disposable
fixtures. Run `bun run test:qmd:models` separately when changing semantic search
or upgrading QMD.

Use `mise exec node@22.22.1 -- bun run test:package` after building to verify the
minimum runtime locally. CI covers both supported runtime versions on Linux and
macOS. Required-check configuration depends on the remote account's repository
capabilities; a passing workflow alone does not enforce branch protection.

Run `mise exec -- bun run benchmark` separately to measure representative
current-file and text-index operations. The [verification guide](docs/contributing/verification.md)
maps conformance scenarios to executable tests and records the measurement method.

1. Inspect the checkout and preserve unrelated changes. Use an isolated worktree
   for concurrent implementation.
2. Implement a cohesive behavior with its tests. Use real temporary files and QMD
   stores where integration matters; keep ordinary tests independent of network
   services and model downloads.
3. Run focused verification while developing, then the full required `check`
   before declaring the change ready. Record what actually ran in the issue or PR.
4. Update authoritative docs when approved behavior changes, and update user
   guidance when a feature becomes available.
5. Link the issue and review rather than duplicating the issue's status in files.

All code, including tests and configuration, must satisfy the strict type, lint,
size, and complexity policy. Refactor to comply. Do not lower thresholds, broaden
exclusions, or add suppressions to make checks pass.

## Documentation and fixtures

- `docs/user/` teaches wiki authors; it should not expose incidental internals.
- `docs/contributing/` defines contributor practices and quality requirements.
- `docs/design/` holds contracts, architecture, and technical plans.
- `examples/wiki/` contains valid fictional documents, not deliberately broken
  fixtures. Keep it useful as a small integration corpus.
- Malformed or byte-sensitive test data belongs in an explicit fixture area when
  tests are implemented. Its narrowly scoped formatting exceptions do not exempt
  TypeScript fixture builders from lint or type checking.

Package verification builds and installs a local tarball in a temporary consumer.
Follow the [release guide](docs/contributing/releases.md) for npm publication.
Publication and external deployment are separate work; successful local checks
do not establish that GitHub required checks or published artifacts exist.
