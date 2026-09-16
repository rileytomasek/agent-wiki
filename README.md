# Agent Wiki

Agent Wiki is a small Markdown document format and a local library and
`wiki` CLI for maintaining and searching a directory of knowledge. Files remain
the source of truth. Ordinary Markdown links form a reference graph, and QMD
provides ranked search.

**Current state:** the library and `wiki` CLI support current-file `show`,
`list`, `related`, and `validate`, exact filters, and a review queue. They use tolerant document parsing,
root discovery, current source snapshots, and a versioned parse cache.
See the [library API](docs/design/library-api.md). Strict quality checks,
development hooks, and CI apply throughout.

## Development setup

Install [mise](https://mise.jdx.dev/getting-started.html), then run:

```sh
mise trust
mise install --locked
mise exec -- bun ci
mise exec -- bun run check
mise exec -- node dist/cli/bin.js --help
```

`mise.toml` installs Node 24.21.0 (development), Node 22.22.1 (minimum
compatibility runtime), Bun 1.4.2, and the metadata-capable QMD source revision.
Agent Wiki uses TypeScript 7.0.2. The library and executable run on Node; Bun
manages development dependencies and scripts. Local installation also enables
the pre-commit and pre-push hooks.

The public `openSearchStore({ dbPath, mirrorPath })` API opens a QMD store at
explicit absolute paths. Its mirror contains generated `qmd.metadata`, including
`source_path`. It provides update, lexical/hybrid search, embedding, status, and
cleanup. Projection from authored wiki documents belongs to subsequent work.
See the [QMD integration contract](docs/design/references/qmd-integration.md).

```sh
mise exec -- bun run test          # Node/Vitest; no model downloads
mise exec -- bun run test:tooling  # Demonstrate checks rejecting violations
mise exec -- bun run test:hooks    # Exercise actual hooks in temporary Git repos
mise exec -- bun run test:qmd:models # Real embedding and hybrid search
```

The separate model proof downloads roughly 2.1 GB into `.cache/model-smoke` on
first use. Package verification installs a local tarball into a fresh temporary
Node/npm consumer and needs access to dependency sources. It does not publish.

## For wiki authors

- [Authoring guide](docs/user/authoring.md): write and connect documents.
- [Type examples](docs/user/type-examples.md): choose useful descriptive labels.
- [Example wiki](examples/wiki/README.md): a small, connected, fictional corpus.
- [Document format](docs/design/document-format.md): the authoritative field and
  content contract.

Start with the [command guide](docs/user/commands.md) for inspecting and validating
current content, including `list --stale`. `search`, `index`, `status`, and
`move` remain planned.

## For contributors

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Agents should also read
[AGENTS.md](AGENTS.md).

| Document                                                  | Authority                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Document format](docs/design/document-format.md)         | Supported authored content and validation rules.                          |
| [CLI specification](docs/design/cli-spec.md)              | Commands, flags, root discovery, and observable behavior.                 |
| [Architecture](docs/design/architecture.md)               | Models, component boundaries, parsing, graph, QMD, and failure handling.  |
| [Implementation plan](docs/design/implementation-plan.md) | Technical sequence, integration prerequisites, and verification approach. |
| [Conformance](docs/design/conformance.md)                 | Durable behavioral scenarios to turn into tests.                          |
| [Tooling policy](docs/contributing/tooling.md)            | Strict types, lint, format, Knip, tests, hooks, packaging, and CI.        |

[The Agent Wiki Linear project](https://linear.app/tomasekio/project/agent-wiki-fc8efac8c2ef)
owns implementation issues, dependencies, priorities, and delivery status.
Specifications and technical plans stay in this repository; no separate backlog
or progress checklist is maintained here.

The initial release is a single TypeScript ESM package with a reusable library and
a Node executable. Bun is a development tool. Optional background indexing and
external enrichment are future work, described only where they affect boundaries.
