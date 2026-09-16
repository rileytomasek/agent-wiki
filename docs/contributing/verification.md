# Verification and implementation decisions

The [tooling policy](tooling.md) defines required gates. This guide records how
the implemented behavior is exercised and the operational choices behind it.
Linear and pull requests retain delivery status.

## Executable conformance

Run `mise exec -- bun run check` for strict formatting, lint, types, both Knip
modes, behavior tests, build, and a fresh Node/npm tarball consumer. Tests run on
Node and use real temporary files and SQLite stores. Normal tests do not require
models or network services after dependencies are installed; the package consumer
does need access to dependency sources.

| Scenarios | Principal executable coverage                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| F01–F14   | `documents/frontmatter-*`, `document-values`, `markdown-*`                                                             |
| W01–W11   | `workspace-*`, `index-partial`, `index-versions`, `index-recovery`                                                     |
| R01–R14   | `graph-*`, `external-identities`, `show*`, `list-*`, `related`, `validate`                                             |
| T01–T05   | `list-review`, `show`, `search-filters`, `conformance-reading`                                                         |
| Q01–Q19   | `projection-*`, `qmd-*`, `index-*`, `search-*`, `conformance-indexing`                                                 |
| M01–M10   | `move-*` and the packaged move/index/search workflow                                                                   |
| C01–C07   | `cli*`, `read-cli-*`, `graph-cli-*`, `index-cli`, `search-cli`, `move-cli`, tarball consumers, enforcement scripts, CI |

Names refer to files under `tests/`. Property tests exercise path normalization,
graph identities, deterministic projection, and exact-span move invariants.
The example wiki is copied to temporary roots for public-library and actual CLI
workflows. Malformed test additions stay outside the valid examples.

`index-interruption` terminates an owned child after its real QMD text update.
It checks persisted incomplete state, useful indexed text, the surviving lock,
refused automatic takeover, and explicit recovery after confirming child exit.
Move failure tests exercise write failures, rollback, concurrent changes, and
uncertain partial outcomes.

`index-selection` and `index-selection-safety` exercise scoped mirrors with a
full reference root, selected-source currency, empty matches, scope changes,
partial scans, and recovery without accidental scope widening.
`index-selection-cli` verifies explicit CLI recovery when scope state is missing
or corrupt; the packaged CLI also exercises scoped indexing and an explicit reset.
`search-owned-store` exercises repeated borrowed-store calls, failure ownership,
and visibility of ordinary SQLite updates. The npm/Bun consumers use the same
public selection and store APIs, including repeated hybrid calls in model checks.

The package consumer installs the actual tarball outside the checkout, removes
Bun from PATH, checks declarations, invokes all eight CLI commands, and exercises
move/index/search through public exports. Normal search tests use native lexical
retrieval through the same QMD store. Successful hybrid CLI search is covered by
the separate real-model smoke test.

CI separates Linux quality/enforcement, Linux/macOS package compatibility, and
move behavior. The macOS move tests assert that the test filesystem is actually
case-insensitive before exercising case-only renames; they verify final filenames
and references. Package installation alone is not evidence of those behaviors.

## Real model proof

Run `mise exec -- bun run test:qmd:models` separately. It uses QMD's default
embedding, expansion, and reranking models in `.cache/model-smoke` (roughly
2.1 GB on first download). On 2026-09-16, macOS arm64/Node 24.21.0:

- Actual `wiki index --json` embedded three documents with zero errors and zero
  pending work. A public-library repeat indexed/embedded no changed documents.
- Actual `wiki search --json` ranked the expected garden document first for a
  semantic cold-weather query, preserving literal Unicode/percent/hash paths,
  native snippets, metadata filtering, scores, and document limits.
- Cached-model process times were 1,379 ms for initial indexing and 5,095 ms for
  hybrid search. These include child-process startup and model initialization;
  downloads were excluded. They are observations, not latency guarantees.

## Representative benchmark

Run `mise exec -- bun run benchmark`. The disposable corpus has 1,000 Markdown
documents, 4,025,800 source bytes, section/citation/named references, and 40
documents with intentionally invalid metadata. Model generation/downloads are
excluded; the text index intentionally retains pending embeddings.

One sample per operation on 2026-09-16, Apple M4/macOS arm64/Node 24.21.0:

| Operation                   |     Time |
| --------------------------- | -------: |
| Parse without derived cache | 1,082 ms |
| Parse with unchanged cache  |    50 ms |
| List, warm                  |    54 ms |
| Validate whole wiki, warm   |    53 ms |
| Related, warm               |    55 ms |
| First text index            |   893 ms |
| Unchanged text index        |   173 ms |
| Status, warm                |    30 ms |

Cold means no derived cache, not a cold operating-system disk cache. Corpus
creation is excluded. Warm reads still hash current source bytes. These results
support retaining the simple parse cache and reconstructed graph; no workers,
persistent graph database, or mtime-only shortcuts were added.

## Material implementation decisions

1. Search follows the approved QMD-native contract. Snippets refer to indexed
   content, totals/truncation remain unknown, and richer section/footnote output
   stays in `show`. There is no custom ranking or repeated filtered retrieval.
2. YAML document references are literal relative filenames. Markdown destinations
   decode URI escapes. This preserves filenames containing literal `%20` or `#`.
3. Source coverage, successful text updates, embedding completion, and review
   deadlines are separate. Status reports dated recorded QMD counts without
   opening models; a SQLite-header check is not a full integrity audit.
4. The shared index/move lock never expires or gets stolen automatically. After
   interruption, verify the recorded owner stopped, remove the abandoned lock,
   and retry. This avoids lease timing and unsafe takeover logic.
5. Optional metadata exceeding QMD limits is omitted with diagnostics. If the
   mandatory original path cannot fit, that projection is skipped and coverage
   stays incomplete; authored document validity remains a separate question.
6. Moves patch exact spans, recheck the full relevant inventory, and use temporary
   originals for best-effort rollback. Partial failures report per-file outcomes;
   multi-file changes do not claim filesystem-wide atomicity. Moves refuse
   rewriting symlinks or their discovered targets, and reference YAML styles
   that cannot be preserved safely. Unrelated usable symlinks remain allowed.
7. GitHub resource recognition is limited to `github.com`; other hosts retain
   conservative generic URL identities. No external content is fetched.
8. Index selections persist independently of the reference root. Omission reuses
   the saved scope; explicit `[]` restores the whole root. Missing scope state
   requires explicit recovery instead of assuming every document should be indexed.
9. Long-running callers own an open search store and close it at shutdown. QMD
   retains its native model lifecycle; no store pool is introduced. Ordinary
   updates remain visible, while rebuilding the SQLite file requires a reopen.

## Operational limits

Package publication and service deployment have separate read-back checks;
local checks do not establish either outcome. Indexing remains explicit.
The first model-dependent operation can require substantial downloads. Interrupted
writers require the documented lock check; incomplete rollback can require manual
recovery using reported backups.

GitHub CI runs are verified separately from branch protection. The private
repository's current GitHub plan returns HTTP 403 for required-check/ruleset
configuration. The workflow runs, but server-side enforcement is unavailable
without changing account capabilities or repository visibility.
