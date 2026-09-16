# QMD integration baseline

## Selected artifact

Both the SDK dependency and mise CLI use upstream
[`04e4dbd8245c527a88f1a8f0bda547aef9ca81fb`](https://github.com/tobi/qmd/tree/04e4dbd8245c527a88f1a8f0bda547aef9ca81fb),
from QMD's `main` branch. The source manifest still says `2.8.3`; the published
npm `2.8.3` tarball predates metadata support. A version string alone cannot prove
this contract.

Mise downloads the immutable source archive with SHA-256
`60a6b1f7063aeca9262355c3422f47db2269bdb85c00a6b2a29d7fbf94561201`,
then builds inside its installation directory with upstream's frozen Bun lock.
This isolates QMD's own TypeScript 5.9 compiler from Agent Wiki's TypeScript 7.0.2.
`mise.lock` records downloads for the supported Linux/macOS environments.

The Bun SDK dependency uses the same full Git revision. Its two-file patch changes
only build plumbing: resolve TypeScript through the installed package layout,
and set `rootDir: "src"` explicitly for TypeScript 7. QMD's hardcoded nested
compiler path is incompatible with Bun's isolated linker. Agent Wiki supplies
QMD's `@types/better-sqlite3` build declarations as a development dependency.
The upstream runtime source is unchanged. A plain npm consumer builds the Git
dependency with upstream's preparation script and its own dependencies; it does
not need the repository's Bun patch, Bun runtime, or Husky.

The upstream TypeScript peer range remains `^5.9.3`; Bun reports the mismatch with
the repository's 7.0.2 compiler. The strict build and fresh npm consumer with its
own TypeScript 7 compiler are the compatibility checks. This is a temporary source
dependency, not a reason to downgrade Agent Wiki's compiler.

When metadata support is published, select the latest release at least 48 hours
old, replace both pins with that release, remove obsolete build adaptations,
regenerate the lockfiles, and rerun normal checks, package consumers, and the real
model proof. Do not change the pins to a floating branch or version selector.

## Public adapter boundary

`openSearchStore` loads QMD lazily and accepts absolute `dbPath` and `mirrorPath`.
It supplies one inline `wiki` collection with `**/*.md`. It exposes only public
SDK operations: complete update, embedding, native filtered lexical/hybrid search,
status, and close. It never reads private database tables or edits QMD's global
configuration file. The public declarations use repository-owned immutable types.
Importing Agent Wiki or running help/version does not open SQLite or load models.

Generated mirror documents must contain valid metadata, for example:

```markdown
---
qmd:
  metadata:
    source_path: 'projects/café %20#[a].md'
    type: doc/guide
    about: [projects/wiki.md]
    stale_after: '2026-09-15'
---

# Example

Indexed body.
```

`source_path` is the authoritative original identity. Do not URL-decode QMD paths
or derive source identity from generated filenames. Missing source identity is an
error. Filters are passed to QMD before retrieval; no post-filtering loop promises
exhaustive results. Dates use ISO strings and missing deadlines do not match a
deadline comparison.

Always update the complete collection. QMD interprets undiscovered paths as
deletions; narrowing the scan to changed files would remove unchanged documents.
The adapter does not expose global collection/context mutation APIs. Although QMD
has a process-local configuration source, the tested update/search/status paths
read each database's collection records. Interleaving stores and closing one does
not redirect another store.

The adapter is an integration baseline. Workspace projection, index locking,
partial-source diagnostics, freshness notices, and command behavior are defined
in the design and implemented in subsequent issues. QMD aggregate counts alone
do not establish complete indexing of an authored wiki.

## Verification

Routine tests use synthetic Markdown and real temporary SQLite stores. They cover
native type/subject/deadline filters, spaces/Unicode/punctuation, full updates and
removals, pending embeddings, two interleaved stores, reopening, and unchanged
synthetic global configuration. Each store is closed and its fixture removed.

`test:package` packs compiled JavaScript and declarations, installs outside the
checkout using Node/npm with no Bun on PATH, compiles a TypeScript 7 consumer with
`skipLibCheck: false`, runs the installed executable, and repeats metadata and
deletion operations through the package's public exports.

`test:qmd:models` is separate from ordinary tests. The initial macOS/Node 24.21.0
proof embedded three documents without errors, reported zero pending embeddings,
and ranked the garden document first for a semantic cold-weather plant query.
It uses QMD's default EmbeddingGemma 300M, query-expansion 1.7B, and Qwen3 reranker
models, cached under `.cache/model-smoke`. CI compatibility jobs exercise native
SQLite and packaging without downloading inference models.
