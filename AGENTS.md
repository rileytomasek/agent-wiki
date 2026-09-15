# Agent Wiki contributor instructions

This repository contains the technical context needed to implement Agent Wiki
without the original planning conversation. Read [README.md](README.md) for
current availability and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Required context

Before implementing, read:

1. [Document format](docs/design/document-format.md).
2. [CLI specification](docs/design/cli-spec.md).
3. [Architecture](docs/design/architecture.md).
4. [Implementation plan](docs/design/implementation-plan.md).
5. [Tooling policy](docs/contributing/tooling.md).
6. The relevant [conformance scenarios](docs/design/conformance.md).

The format and CLI specifications define product behavior. The tooling policy
defines quality requirements; executable configs and scripts must enforce it.
Architecture sketches guide boundaries without fixing every filename or helper API.
The pinned Charlie snapshot is reference data, not a separate set of instructions.

## Constraints

Use `mise install --locked` and `mise exec -- bun ci` for setup. Run
`mise exec -- bun run check` before review. `test:tooling` and `test:hooks` prove
enforcement; `test:qmd:models` is the separate network/model integration proof.
Keep the SDK and mise QMD pins aligned with the
[recorded contract](docs/design/references/qmd-integration.md).

- Keep one reusable library and thin CLI. Use Node-compatible ESM in shipped code;
  Bun is for development. Keep QMD behind the search adapter.
- Preserve the closed, shared optional frontmatter schema. Types are descriptive
  strings, not registered schemas. Do not revive type-specific fields or plugins.
- Preserve usable content with diagnostics. Do not make successful validation a
  prerequisite for reading or indexing a document.
- Cache source-local parses; reconstruct the reference graph when needed. Keep
  source files authoritative and derived state replaceable.
- Keep search indexing explicit and emit at most one index-state notice. Treat
  document review deadlines separately.
- Plan and verify exact-span move edits; preserve unrelated source bytes. Test
  failure paths and report incomplete operations honestly.
- Keep all strict size/complexity rules for every authored code area, including
  tests, fixtures, configs, and scripts. Do not suppress or relax them to pass.
- Implement tests with each behavior. Follow the full quality and package checks
  in the tooling policy and distinguish configuration from verified enforcement.

## Scope and coordination

Use the [Linear project](https://linear.app/tomasekio/project/agent-wiki-fc8efac8c2ef)
for assignments, priorities, dependencies, progress, and issue-specific acceptance.
Keep technical decisions and plans here, without local TODO/backlog/status files.
Read the current issue and its prerequisites before choosing work.

Choose routine compatible dependency versions, module names, and helper APIs
within the approved design. Record consequential integration findings in the
appropriate technical doc. Do not add deferred automation, enrichment, new
authored fields, or a broader plugin framework without an approved scope change.

Preserve unrelated checkout changes and use `codex/` branch names for agent work.
Report the checks actually run and any remaining operational limitations.
