# Agent Wiki

Agent Wiki is a small Markdown document format and a local library and
`wiki` CLI for maintaining and searching a directory of knowledge. Files remain
the source of truth. Ordinary Markdown links form a reference graph, and QMD
provides ranked search.

**Current state:** the library and `wiki` CLI implement `search`, `show`, `list`,
`related`, `validate`, `index`, `status`, and `move`, including exact filters,
a review queue, and moves with precise reference updates.
They use tolerant document parsing, current source snapshots, a versioned parse
cache, and a dedicated QMD index with deterministic generated metadata.
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
cleanup. `indexWiki(root)` coordinates source refresh, projection, text updates,
and missing embeddings; `indexStatus(root)` inspects source currency and recorded
coverage without loading QMD or models. `searchWiki(root, query)` searches that
snapshot with QMD's native hybrid ranking, filters, scores, and snippets.
See the [QMD integration contract](docs/design/references/qmd-integration.md).

Library callers can index a subset with
`indexWiki(root, { selections: ['records/**/*.md'] })` while retaining the full
repository as the reference boundary. Later indexing and currency checks reuse
the saved scope. Long-running services can pass a caller-owned store from
`openSearchStore(indexPaths(root))` to `searchWiki(root, query, { store })`;
close it at shutdown and reopen it after a rebuild. See the
[selection and store contracts](docs/design/library-api.md#explicit-indexing-and-status).

```sh
mise exec -- bun run test          # Node/Vitest; no model downloads
mise exec -- bun run test:tooling  # Demonstrate checks rejecting violations
mise exec -- bun run test:hooks    # Exercise actual hooks in temporary Git repos
mise exec -- bun run test:qmd:models # Real embedding and hybrid search
```

The separate model proof downloads roughly 2.1 GB into `.cache/model-smoke` on
first use. Package verification installs a local tarball into fresh temporary
Node/npm and Bun consumers and needs access to dependency sources. It does not publish.

## For wiki authors

### Install

```sh
npm install --global @rileytomasek/agent-wiki
wiki --help
wiki show guides/deployment.md --root /path/to/your/wiki
wiki index --root /path/to/your/wiki
wiki search 'deployment' --root /path/to/your/wiki
```

For the library:

```sh
npm install @rileytomasek/agent-wiki
```

```js
import { showDocument, indexWiki, searchWiki } from '@rileytomasek/agent-wiki';

const root = '/absolute/path/to/your/wiki';
const document = await showDocument(root, 'guides/deployment.md');
await indexWiki(root);
const results = await searchWiki(root, 'deployment');
```

The package supports Node `^22.22.1` or `^24.21.0`. Fresh Bun 1.4.2
installations are also verified. For Bun projects with an explicit lifecycle
allowlist, include `better-sqlite3` and `node-llama-cpp` in
`trustedDependencies`, then run `bun install`. No global QMD installation,
source-build patches, Bun runtime, or development hooks are required by Node
consumers. Agent Wiki installs its prebuilt QMD dependency automatically.

The first index/search operation that needs models can download roughly 2.1 GB.
Current-file inspection and validation work without those models. Reads use the
current Markdown files; search uses the last explicit `wiki index` snapshot.

Agent Wiki is published as
[`@rileytomasek/agent-wiki`](https://www.npmjs.com/package/@rileytomasek/agent-wiki)
under the MIT license. The temporary QMD snapshot preserves upstream's MIT
license and source identity. See the [release guide](docs/contributing/releases.md)
for packaging and publication.

- [Authoring guide](docs/user/authoring.md): write and connect documents.
- [Type examples](docs/user/type-examples.md): choose useful descriptive labels.
- [Example wiki](examples/wiki/README.md): a small, connected, fictional corpus.
- [Document format](docs/design/document-format.md): the authoritative field and
  content contract.

Start with the [command guide](docs/user/commands.md) for inspection, review,
search indexing, and safe document moves. See [verification and implementation
decisions](docs/contributing/verification.md) for tests, benchmarks, and remaining
operational limits.

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
