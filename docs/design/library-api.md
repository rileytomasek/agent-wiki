# Library API

The package exports Node-compatible ESM functions and readonly TypeScript
contracts. Callers supply a wiki root; CLI root discovery is available separately.
The [format](document-format.md) and [CLI contract](cli-spec.md) govern behavior.

## Current source and parsing

```ts
import {
  resolveRoot,
  readDocument,
  refreshWorkspace,
} from '@rileytomasek/agent-wiki';

const root = await resolveRoot({ cwd: process.cwd() });
const current = await readDocument(root, 'projects/wiki.md');
const workspace = await refreshWorkspace(root);
```

`readDocument` reads one current Markdown file. `refreshWorkspace` returns current
document snapshots, discovered file/document paths, operational diagnostics,
confirmed cache removals, and a `complete` flag. Unreadable files are absent from
current snapshots and leave operational diagnostics; older cache records are
retained only for recovery. Discovery does not follow directory symlinks or read
outside the root. Missing, corrupt, or incompatible caches are reconstructed.
Read operations create no marker. Optional cache persistence is nonfatal.

`unavailable` contains unvisited directory prefixes. Coordinators reconciling
their own prior inventories must preserve entries beneath those prefixes; the
`removed` list describes only records present in the compatible parse cache.

A `DocumentSnapshot` pairs `source` with a `ParsedDocument`. The parsed document
contains the path, hash, display title, valid shared metadata, body and section
spans, footnotes, references, local diagnostics, and `referencesComplete`.
Content diagnostics do not prevent a useful snapshot. `parseDocument` also works
without filesystem access, accepting `{ path, source, sourceHash }`; `hashSource`
provides the same SHA-256 fingerprint used by workspace reads.

All spans address the original JavaScript string: UTF-16 offsets, exclusive ends,
and one-based line/column locations. They are not byte offsets. Body slices retain
the original line endings and exclude a recognized leading frontmatter block.
The cache stores normalized parse facts, never source bodies, parser ASTs,
cross-document resolution, or clock-dependent freshness.

## Destinations and review dates

`normalizeWikiPath` normalizes literal root-relative paths without URL decoding.
`normalizeReferencePath` resolves authored URI destinations from their containing
document, decodes URI escapes, and rejects escapes outside the root.
`normalizeDocumentPath` resolves named YAML reference fields as literal paths:
`notes%20today.md` names a file containing `%20`, not a space. These fields target
documents; section fragments belong in Markdown links. Backslash separators are
unsupported; wiki paths consistently use `/`.
`typeSegments` derives category/name only when slash segments exist.

`invocationDate(clock?)` captures one local calendar date for an operation.
`reviewStatus(deadline, today)` returns a stale flag and, when a deadline exists,
the deadline and nonnegative days overdue. Today is already due. No read, edit,
or index operation changes an authored deadline.

## Exact edit information

A reference has one destination span and any number of use sites. Shared
Markdown definitions can appear in several origin contexts with the same edit
span; an edit planner must deduplicate that span. Unused definitions remain
available for preserving authored destinations, with no use sites.

Markdown spans address the destination inside any angle delimiters. YAML spans
address the scalar token, including its quote or block style; editors must retain
the style and comments when changing its value. `referencesComplete: false`
means a full reference-preserving rewrite cannot be guaranteed. It does not make
the source unreadable.

## Inspection operations

`showDocument(root, target, { clock? })` returns a `ShowResult` with `document`
metadata/review status, `content`, optional `section`, ancestor `headingContext`,
included `footnotes`, diagnostics, and `complete`. Whole-document content is the
unchanged source. Section content joins original heading/body/footnote slices.
`OperationError` carries a stable code and candidate paths for ambiguous aliases.

`listDocuments(root, { filters?, limit?, clock? })` returns a `ListResult` with
`documents`, `total`, `truncated`, diagnostics, and `complete`. Each document has
its path, title, normalized metadata, and review status. Exact filters combine
with AND before the positive integer limit; the default is unlimited. `total`
counts matching readable documents; `complete: false` distinguishes partial
filesystem coverage from an exhaustive list. Content diagnostics describe the
returned documents, with operational problems reported separately in the same
diagnostic array. Both operations capture their clock once before asynchronous
reads and do not initialize search.

## Explicit indexing and status

`indexWiki(root, { selections?, rebuild?, clock?, io?, embed? })` returns an `IndexResult`
with `root`, `complete`, QMD `update`/`embedding` results, persisted `state`, and
diagnostics. Production defaults call the public QMD update and embedding APIs.
The optional `embed` callback is an integration seam for offline tests and
callers that control embedding work; remaining QMD work still prevents a complete
result. Invalid authored metadata remains diagnostic data, not a gate on indexing
usable content. Projection warnings describe omitted search metadata separately.

`selections` accepts root-relative Markdown files, recursive directories, or globs,
using the same matching rules as validation. For example,
`indexWiki(root, { selections: ['records/**/*.md'] })` indexes records while the
repository root remains the boundary for reads and reference validation. Selection
limits the search mirror and its source fingerprints; it does not change authored
paths or the discovery rules used by other operations. An empty match is valid for
indexing, including when the final selected document has been deleted.

Selections are normalized, deduplicated, and saved. Omission reuses the saved
selection, including from `wiki index` and `wiki index --rebuild`; an explicit `[]`
or `['.']` selects the whole root. New indexes default to the whole root. Source
currency hashes only selected documents, so unrelated edits do not make search
stale. Failed reads or scans affecting selected paths remain incomplete.

The requested selections and the successful text baseline's selections are
recorded separately. Changing selection requires complete selected-source and
projection coverage before reconciling the mirror. A failed scope change retains
the prior index and cannot claim current currency; the next explicit index retries
the saved request. Missing or corrupt selection state beside an existing index
requires explicit `indexWiki` selections rather than silently widening its scope.
Version-one state migrates as a whole-root selection; new state uses version two.

State stores the last observed QMD counts with `countsAt`, `textUpdatedAt` for a
successful QMD text reconciliation, and `lastCompletedAt` for a fully completed
run. `baseline` holds source hashes and parser/discovery/projection/QMD versions
from the last text update with complete source coverage. A partial reconciliation
can advance `textUpdatedAt` while retaining the older complete baseline. Run
stages are checkpointed atomically so interrupted work remains visibly incomplete.

`indexStatus(root, { io? })` returns availability, source `currency`, a summary
`status`, saved `selections`, recorded coverage/count timestamps, pending embeddings, source changes,
diagnostics, and two completion flags. `complete` describes the inspection's
operational coverage; `indexComplete` describes the recorded indexing run. An
absent index is a successful inspection. Invalid state or an unreadable source
cannot establish current currency. A shallow SQLite-header check detects obvious
database corruption; this is not a full SQLite integrity audit. Status reads
source hashes without parsing Markdown or opening QMD/model runtimes.

Mirror reconciliation uses its own file inventory and the source scan's unvisited
prefixes, so deleting a parse cache does not disable confirmed removals. If a
partial scan cannot establish retained mirror copies, QMD update is refused to
protect its existing text snapshot. Rebuild requires complete source/projection
coverage before removing existing search data. Derived directories and mirror
files cannot redirect indexing through symlinks.

Index and move use the same exclusive workspace lock. It records a PID, host,
and random ownership token. Acquisition never steals a preexisting lock; after
an interrupted writer, the operator verifies that the owner stopped, removes the
abandoned lock, and retries. This avoids time-based lease expiry or racy automatic
lock takeover. Release verifies that ownership has not changed.

## Snapshot search

`searchWiki(root, query, { filters?, limit?, clock?, store?, search? })` uses QMD's
native hybrid search by default. Exact type/category/name/about and review
deadline filters combine with AND. QMD owns candidate selection, ranking,
chunking, and the default result limit. The optional `search` callback is an
integration seam for deterministic offline tests using the same store's lexical
search; it is not a second retrieval engine.

Long-running callers can reuse an open store. `indexPaths(root)` returns the
absolute paths for that root's dedicated store and derived files. Pass a store
opened with those paths to `searchWiki` for the same root; the caller closes it
at shutdown. Search never closes a supplied store, including on failure, and
never calls its update or document-embedding methods. Without `store`, each call
opens and closes its own store. Reuse keeps QMD's model context available between
requests; QMD still controls its native idle-model disposal policy.

```ts
import {
  indexPaths,
  openSearchStore,
  searchWiki,
} from '@rileytomasek/agent-wiki';

const store = await openSearchStore(indexPaths(root));
try {
  const semantic = await searchWiki(root, 'winter plant care', { store });
  const keyword = await searchWiki(root, 'orchid', {
    store,
    search: (opened, query, options) => opened.searchLex(query, options),
  });
} finally {
  await store.close();
}
```

Open stores see ordinary explicit index updates. Stop and reopen long-running
search stores around `indexWiki(root, { rebuild: true })` or `wiki index --rebuild`,
which replace the SQLite file. Stores are caller-owned resources, not an automatic
pool; use the matching root and coordinate shutdown/rebuild in the embedding app.

Results contain `documents` with original indexed path, title, score, metadata,
review status, and `{ text, source: 'index' }` snippets. The adapter calls QMD's
public `extractSnippet` with its indexed body and native chunk information.
Snippet header positions address indexed content, including generated metadata.
Search adds no custom heading breadcrumbs or footnote definitions.

`total` and `truncated` are `null`: QMD does not expose exhaustive totals or a
reliable truncation signal. `indexNotice` is either `null` or one notice with
status, recovery command, and diagnostics. `complete` describes operational
inspection coverage, not whether the indexed snapshot is current or exhaustive.
A stale snapshot remains searchable. A missing index throws an actionable
`OperationError`; search never starts document indexing or embedding work.
Normal query embeddings and reranking remain part of native hybrid search.

## Relationships and validation

`buildGraph(workspace)` is a pure operation over normalized snapshots and file
inventory. It reconstructs target, alias, incoming, and outgoing maps, preserving
unresolved reference occurrences. No graph state is persisted.

`related(root, target, { limit? })` returns the target and immediate
`relationships`, known `total`, `truncated`, diagnostics, and `complete`. Each
relationship has a direction and an occurrence retaining the authored reference,
source path/section, use location, and resolved or unresolved destination. A
self-reference has direction `both` and consumes one relationship slot.

`validate(root, selections?)` returns `selectedPaths`, diagnostics, `complete`,
and `valid`. Selection accepts literal files, recursive directories, and globs;
an unmatched selection throws `OperationError`. Whole-wiki context is always
available to resolution, even when reporting diagnostics for selected files.
`complete` describes operational coverage, while `valid` additionally requires
no structural errors. Neither operation initializes QMD or fetches URLs.

GitHub recognition is intentionally limited to `github.com`; other hosts use
conservative generic URL identities. Recognized resources include the host and
owner/repository namespace. Authored URLs and selectors stay on occurrences.
Generic URL identities retain query parameters and fragments, including for
non-HTTP schemes. Alias collisions are lookup ambiguity, not structural errors.

## Planned document moves

```ts
import {
  applyMove,
  formatMoveDiff,
  moveDocument,
} from '@rileytomasek/agent-wiki';

const preview = await moveDocument(root, 'old.md', 'notes/new.md', {
  dryRun: true,
});
console.log(formatMoveDiff(preview.plan));
const result = await applyMove(preview.plan);
```

`moveDocument(root, from, to, { dryRun?, io? })` holds the shared writer lock
through a current refresh, planning, and application or preview. `applyMove(plan,
{ io? })` acquires the same lock and rechecks every discovered document hash and
file identity. It regenerates the complete plan, rejecting omitted or altered
edits. `buildMovePlan(workspace, from, to)` is the pure planning boundary for
callers with an existing snapshot. Only operational entrypoints lock or write.

`MovePlan` contains normalized `from`/`to`, complete file inventory, all source
fingerprints, diagnostics, and `changes`. Each change retains original/resulting
paths, `before`/`after` source, source hash, and deduplicated exact `SourceEdit`s.
`formatMoveDiff` produces complete before/after hunks and rename information.
The planner reparses projected source and verifies reference identities, origins,
uses, and scalar styles before exposing a plan. It preserves unresolved local
targets and refuses outgoing destinations whose meaning cannot be safely rebased.

`MoveResult` has `status` (`dry-run`, `applied`, `rolled-back`, or `partial`),
`complete`, the plan, diagnostics, recovery paths, and current per-path `files`
states. `complete: false` always means the requested operation did not finish
cleanly, including cleanup or lock-release failures after content was applied.
Unrelated content diagnostics alone do not make a move incomplete.

Apply stages replacements beside their destination, preserves temporary original
files beside each source, and exclusively creates destination entries. Rechecks
catch changed sources and newly occupied destinations; external editors do not
honor the cooperative writer lock. Rollback never overwrites a concurrent writer.
Partial rollback retains originals and staging files for explicit recovery, with
original filenames embedded in backup names. No multi-file atomicity is claimed.
Affected parses are invalidated after success; search state is left stale.

Reads may follow supported in-root file symlinks. Moves refuse authored symlink
entries, symlinked parents, and any discovered file symlink pointing at a moved
or rewritten source. An alternate path can interpret the same changed bytes
relative to a different directory; symlinks to unaffected files remain usable.

The optional `MoveIO` seam supports deterministic filesystem-failure testing.
Separate Linux/macOS behavior jobs exercise move failures; macOS tests establish
that their filesystem is case-insensitive before proving case-only rename and
reference outcomes. Those are separate from packed-consumer compatibility checks.
