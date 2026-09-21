# QMD integration baseline

## Selected artifact

The SDK uses the exact npm alias
`@tobilu/qmd: npm:@rileytomasek/qmd-snapshot@2.8.3-snapshot.04e4dbd.0`.
The snapshot and mise CLI both contain upstream
[`04e4dbd8245c527a88f1a8f0bda547aef9ca81fb`](https://github.com/tobi/qmd/tree/04e4dbd8245c527a88f1a8f0bda547aef9ca81fb).
Upstream's source manifest still says `2.8.3`; the official npm `2.8.3`
tarball predates metadata support. A version string alone cannot prove this
contract. `tests/index-versions.test.ts` ties the alias, snapshot manifest, index
build identity, and mise source/checksum pins together.

The snapshot builder downloads the immutable source archive and verifies SHA-256
`60a6b1f7063aeca9262355c3422f47db2269bdb85c00a6b2a29d7fbf94561201`.
It builds in a temporary directory with upstream's frozen Bun lock and TypeScript
5.9 toolchain, then packages compiled output, runtime resources, the upstream MIT
license, and an `UPSTREAM.json` record. Runtime code and native dependencies are
unchanged. Source-build scripts, development dependencies, and the build-only
TypeScript peer are omitted. The CLI build stamp identifies the verified commit.
Consumers do not need TypeScript to compile QMD or Agent Wiki's former Bun build
patches. The [snapshot README](../../contributing/qmd-snapshot.md) explains the
unofficial distribution.

Mise retains the same checksum-verified upstream archive and isolated build for
its development CLI. It is not a runtime dependency of the published library.
`mise.lock` records downloads for supported Linux/macOS environments.

The repository's 48-hour dependency age policy remains in force for third-party
packages. Only our exact, source-verified `@rileytomasek/qmd-snapshot` release is
exempt so its own publication and integration checks can run immediately.

When metadata support is officially published, select a tested release at least
48 hours old, replace the npm alias and mise pin, preserve/update the recorded
index build identity, regenerate lockfiles, and run normal checks, fresh npm/Bun
consumers, and the real-model proof. Retire snapshot publishing at that point;
no consumer should import the snapshot directly or require a custom adapter.

## Public adapter boundary

`openSearchStore` loads QMD lazily and accepts absolute `dbPath` and `mirrorPath`.
It supplies one inline `wiki` collection with `**/*.md`. It exposes only public
SDK operations: complete update, embedding, native filtered keyword/semantic/hybrid search,
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

The workspace coordinator provides deterministic metadata projection, exclusive
index locking, partial-source preservation, and explicit index/status commands.
QMD aggregate counts alone do not establish complete indexing of an authored
wiki; source coverage and text/embedding stages remain separately recorded.

Search mapping retains indexed `body`, `bestChunk`, and `bestChunkPos`, then uses
the exported `extractSnippet` helper. Public wiki search returns its native text
with an indexed-content label; it does not turn generated positions into exact
original-source lines. Titles, metadata, and review deadlines come from the
snapshot, even when current files have changed or moved. Search totals and
truncation are unknown rather than inferred from a bounded result window.

## Search modes

The adapter uses only the pinned public SDK. `keyword` calls `searchLex`;
`semantic` calls `search` with the original query as both `lex` and `vec` entries
in `queries`, plus `rerank: false`; `hybrid` calls `search({ query })` with native
defaults. Structured queries bypass expansion. QMD owns fusion weights, candidate
selection, chunking, and scores. No manual merging or private-table access is
introduced. Agent Wiki and CLI defaults remain hybrid; embedding applications
can select a different default explicitly.

Semantic input folds CR/LF to spaces, preserving the query otherwise. QMD's
balanced-quote and vector-negation validation stays authoritative. Unknown mode
values fail instead of silently selecting expensive inference. The model proof
observes native inference calls: keyword invokes none, semantic embeds but
cannot invoke expansion/reranking, and hybrid invokes the existing reranker.
The observation uses native internals only in verification, not shipped code.

## Verification

Routine tests use synthetic Markdown and real temporary SQLite stores. They cover
native type/subject/deadline filters, spaces/Unicode/punctuation, full updates and
removals, pending embeddings, two interleaved stores, reopening, and unchanged
synthetic global configuration. Each store is closed and its fixture removed.

`test:package` packs compiled JavaScript and declarations, installs outside the
checkout using Node/npm with no Bun on PATH, compiles a TypeScript 7 consumer with
`skipLibCheck: false`, runs the installed executable, and repeats metadata and
deletion operations through the package's public exports. `test:package:bun`
repeats these workflows with a fresh isolated Bun install/cache and Bun library
execution, including the Node CLI installed by Bun. `test:qmd:models` additionally
exercises real embeddings and hybrid search through both installed packages.

`test:qmd:models` is separate from ordinary tests. The macOS/Node 24.21.0
proof on 2026-09-16 indexed and embedded three documents through `indexWiki`
without errors, reported current status with zero pending embeddings, and ranked
the garden document first for a semantic cold-weather plant query through the
actual `wiki search --json` executable. It also verified native snippets, literal
Unicode/percent/hash paths, filters, limits, scores, and one valid JSON result.
It uses QMD's default EmbeddingGemma 300M, query-expansion 1.7B, and Qwen3 reranker
models, cached under `.cache/model-smoke`. CI compatibility jobs exercise native
SQLite and packaging without downloading inference models.
