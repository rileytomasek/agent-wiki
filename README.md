# Agent Wiki

Agent Wiki is a small Markdown document format and a planned local library and
`wiki` CLI for maintaining and searching a directory of knowledge. Files remain
the source of truth. Ordinary Markdown links form a reference graph, and QMD
provides ranked search.

**Current state:** this repository contains the agreed specifications, engineering
plan, contributor policy, upstream tooling reference, and example documents. The
CLI, package, executable tests, development hooks, and CI are not implemented yet.
The planned commands below are a product overview, not installation instructions.

## For wiki authors

- [Authoring guide](docs/user/authoring.md): write and connect documents.
- [Type examples](docs/user/type-examples.md): choose useful descriptive labels.
- [Example wiki](examples/wiki/README.md): a small, connected, fictional corpus.
- [Document format](docs/design/document-format.md): the authoritative field and
  content contract.

The planned CLI supports `search`, `show`, `list`, `related`, `validate`,
`index`, `status`, and `move`. It includes a review queue through `list --stale`,
explicit search indexing, and moves that update references.

## For contributors

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Agents should also read
[AGENTS.md](AGENTS.md).

| Document | Authority |
| --- | --- |
| [Document format](docs/design/document-format.md) | Supported authored content and validation rules. |
| [CLI specification](docs/design/cli-spec.md) | Commands, flags, root discovery, and observable behavior. |
| [Architecture](docs/design/architecture.md) | Models, component boundaries, parsing, graph, QMD, and failure handling. |
| [Implementation plan](docs/design/implementation-plan.md) | Technical sequence, integration prerequisites, and verification approach. |
| [Conformance](docs/design/conformance.md) | Durable behavioral scenarios to turn into tests. |
| [Tooling policy](docs/contributing/tooling.md) | Strict types, lint, format, Knip, coverage, hooks, packaging, and CI. |
| [Charlie tooling reference](docs/design/references/charlie-tooling.md) | Pinned upstream configuration snapshot to adapt under the tooling policy. |

[The Agent Wiki Linear project](https://linear.app/tomasekio/project/agent-wiki-fc8efac8c2ef)
owns implementation issues, dependencies, priorities, and delivery status.
Specifications and technical plans stay in this repository; no separate backlog
or progress checklist is maintained here.

The initial release is a single TypeScript ESM package with a reusable library and
a Node executable. Bun is a development tool. Optional background indexing and
external enrichment are future work, described only where they affect boundaries.
