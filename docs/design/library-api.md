# Library API

The package exports Node-compatible ESM functions and readonly TypeScript
contracts. Callers supply a wiki root; CLI root discovery is available separately.
The [format](document-format.md) and [CLI contract](cli-spec.md) govern behavior.

## Current source and parsing

```ts
import { resolveRoot, readDocument, refreshWorkspace } from 'agent-wiki';

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
