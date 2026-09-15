# Implementation Plan

This plan explains how to turn the [CLI specification](cli-spec.md) and
[architecture](architecture.md) into one usable library and executable. Delivery
issues, dependencies, progress, and issue-specific acceptance criteria live in the
[Linear project](https://linear.app/tomasekio/project/agent-wiki-fc8efac8c2ef).
This document is technical guidance, not a second work tracker.

## Establish the integration baseline

Create a single TypeScript ESM package with library and CLI entrypoints, explicit
exports, declarations, and a local package-consumer smoke test. Implement the
complete [tooling policy](../contributing/tooling.md) from the start, adapting the
[pinned Charlie configuration](references/charlie-tooling.md). Keep tests, scripts,
and config code within the same type and size/complexity rules as production code.

Choose and pin compatible Node, Bun, TypeScript, Oxlint/type-aware engine, Oxfmt,
Knip, Vitest/V8, and QMD artifacts. Bun invokes development scripts; shipped code
and tests run on Node. Add strict checks, staged fixes, pre-push checks, and CI
through shared scripts. Verify the minimum supported and development Node
versions against the actual dependency set.

Before committing to the QMD adapter, prove its public contract in a temporary
store. The examined source revision is
`04e4dbd8245c527a88f1a8f0bda547aef9ca81fb`; package version text alone did not
establish that the installed artifact included metadata support. Verify:

- Explicit database path and inline collection configuration isolate each wiki.
- `createStore`, full-collection update, missing embeddings, search with native
  metadata filters, and status are exposed by the selected artifact.
- Original path mapping survives spaces, Unicode, and punctuation.
- Updates and confirmed deletions work without changing global QMD configuration.
- Store cleanup and packaged Node imports work outside the source checkout.

Use ordinary non-model integration tests for metadata, lifecycle, and isolation.
Perform a separate real embedding/hybrid-search smoke test when selecting or
upgrading QMD. Record the selected artifact and any contract adaptation in the
architecture/reference documentation; do not depend on private database tables
or treat a mocked adapter as proof of compatibility.

## Build the document core

Implement shared immutable contracts and diagnostic codes first, then root
resolution, discovery, source snapshots, and the pure parser. Parse GFM,
footnotes, and optional leading YAML using ASTs and source spans. Validate the
closed shared frontmatter fields without making a valid document a prerequisite
for useful output. Preserve unambiguous valid fields and the readable body.

Keep path normalization, heading anchors, date handling, type-segment extraction,
and reference-destination spans shared across operations. Use an injected clock
and explicit root in library APIs. Offsets always refer to the original JavaScript
string, including its actual line endings.

Add the versioned source-local parse cache around that pure contract. Discover,
read, and hash the current files; reparse only new/changed/incompatible records.
Drop only confirmed deletions. Corrupt derived state is recoverable. An unreadable
source or incomplete scan cannot become a successful current empty document.

Prove cache behavior with actual temporary directories, including same-size edits
with unchanged modification times. Avoid persistent graph structures and stat-only
correctness shortcuts. Keep direct path reads narrow and optional cache writes
nonfatal.

## Add current-file inspection

Build `show` and `list` on the document core. A shared CLI boundary handles
global flags, normalized filter inputs, text/JSON rendering, and exit behavior.
Specify and test the public result shapes as they are introduced; keep data and
diagnostics structured instead of making callers parse human output.

`show` uses current source slices and includes referenced footnote definitions.
Path/anchor lookup should not require a complete graph; alias lookup needs an
inventory and must report ambiguity. `list` applies exact filters before limiting,
including root-relative subjects, type/category/name, path globs, and review
deadlines. Compute one invocation-wide date; do not cache a stale boolean.

Neither command needs QMD, model loading, or a search database. Test globals both
before and after commands and keep progress off JSON stdout.

## Resolve references and validate

Construct target, alias, and adjacency maps from normalized parses. Preserve every
reference occurrence, origin, destination span, use site, and unresolved outcome.
Resolve document/section/attachment targets and offline external URLs; support
GitHub resource recognition with a conservative generic fallback.

Use these indexes for `related` and whole-wiki or selected `validate`. Selection
limits reported document diagnostics, not the lookup context used to resolve
references. Quoted globs are expanded by the CLI, matches are deduplicated, and
unmatched selections are errors. Incomplete discovery must be visible.

Keep footnote citations, ordinary links, and named metadata relationships distinct.
There is no implication of evidential support from a citation or from a Sources
heading. External recognition does not require network access.

## Integrate indexing and status

Project current documents into deterministic generated Markdown under the wiki's
cache directory. Preserve body bytes and footnotes, replace frontmatter with valid
`qmd.metadata`, and retain source-path/title/body-line mapping. Do not extend the
authored schema with generated fields.

Build the explicit `index` coordinator: acquire the workspace write lock, refresh,
project changed copies, remove confirmed deletions, update the complete QMD
collection, generate missing embeddings, and record coverage and failures.
Interrupted runs can be retried. Never pass a changed-files-only glob to a
collection update that uses discovery to infer removals.

Keep a successful text-update baseline separate from embedding completion and the
last fully completed run. Source/projection problems must not be hidden by QMD
aggregate counts. A temporary read failure preserves the last indexed copy but
leaves the index incomplete.

`status` inspects availability, currency, coverage, pending embeddings, and
problems without creating a missing index or loading inference models.
`index --rebuild` rebuilds search-derived data without rewriting authored files.
Keep optional future external observations outside disposable search state.

## Add snapshot search

Translate the agreed filters to QMD's native metadata conditions and use its
ranking/candidate limits. Do not add exhaustive filtered retrieval, repeated
post-filtering, or search path globs. Every returned result must satisfy the
filters; selective queries may return fewer documents than requested.

Return one best passage per document initially, original paths, indexed title and
review metadata, heading context, and relevant footnotes from the indexed body.
Map body locations using the preserved source offset information; generated
metadata matches must not acquire invented body positions.

Check index currency without parsing all Markdown or updating the index. Emit one
index-level stale/incomplete notice with the recovery command, represented once
in JSON. Search reads the indexed snapshot; `show` reads current source. Keep that
simple distinction instead of maintaining per-result version reconciliation.

## Implement safe moves

Reuse the graph, source spans, shared path rules, and workspace write lock.
Separate planning from application. Gather sufficiently complete reference
coverage, refuse collisions/root escapes, and expose the full path/content diff
through `--dry-run`.

Rewrite incoming destinations and reference fields, plus outgoing relative
references inside the moved file. Include sections, attachments, self-links,
reference definitions, and citations. Preserve YAML style, link labels, fragments,
footnote identifiers, and unrelated source bytes. Patch shared destinations once.

Recheck source hashes and destination conditions before writing. Stage replacement
files and temporary originals, attempt rollback on failure, and report partial
outcomes honestly. A multi-file move is not inherently atomic. Invalidate affected
parses and leave search stale after success. Exercise case-only renames on macOS
as well as ordinary Linux filesystem behavior.

## Integrate and verify the package

Tests accompany each implementation stage. Use the [conformance scenarios](conformance.md)
as a durable cross-command suite, then verify complete workflows on a temporary
copy of the [example wiki](../../examples/wiki/README.md). Do not defer basic tests
or strict checks to a final integration stage.

Verify actual CLI subprocess behavior and the library's public types. Build a
tarball, install it in a fresh consumer outside the checkout, and exercise both
entrypoints under the supported Node/platform matrix. Run the full quality gate
once per required primary environment with the specified coverage floors. Verify
CI and required-check enforcement when a remote is configured; report that
separately from local results.

Update user documentation to describe implemented commands and real setup steps.
Retain honest availability language until the features work. Benchmark cold/warm
operations with realistic document sizes and malformed inputs, reporting environment
and model costs separately. The exploratory architecture timings are not release
latency targets.

## Scope boundaries and implementation discretion

The first release includes the eight specified commands, offline external targets,
and development quality hooks. Indexing-hook installation, background watchers,
external enrichment, provider configuration, and publication are deferred.
Do not add plugin loading or schedulers merely to reserve future extension points.

Choose compatible dependency versions, helper APIs, JSON field names, diagnostic
codes, and source filenames while preserving the observable contracts. Document
consequential choices and test them. A requirement change belongs in the relevant
specification and Linear scope; a routine internal choice need not reopen the
approved architecture.
