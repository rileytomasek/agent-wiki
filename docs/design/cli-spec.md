# Agent Wiki CLI

Functional specification for the `wiki` CLI operating on the [Agent Wiki format](document-format.md).

See the [architecture](architecture.md) for component boundaries, data models, and indexing; the [implementation plan](implementation-plan.md) describes the technical sequence.

## Commands

| Command                  | Behavior                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search <query>`         | Search the existing QMD snapshot with native ranking, filters, scores, and snippets. Return original indexed paths, titles, metadata, and review status, with at most one index-state notice.                     |
| `show <target>`          | Display a document or section by path, heading anchor, or unambiguous alias. Include footnote definitions referenced by displayed content.                                                                        |
| `list`                   | List documents and metadata using exact filters, ordered by path unless `--stale` is supplied.                                                                                                                    |
| `related <target>`       | Show immediate incoming and outgoing references for a local target or external URL, distinguishing body links, citations, and named frontmatter references, with originating fields or source locations.          |
| `validate [selections…]` | Validate the whole wiki without arguments; otherwise accept files, recursive directories, globs, and multiple selections.                                                                                         |
| `index [selections…]`    | Update the QMD search index from current selected wiki files and generate missing embeddings. Report changes, skipped files, and failures. `--rebuild` recreates the search index.                                |
| `status`                 | Show the resolved root, index availability and coverage, pending embeddings, last completed update, and known indexing problems.                                                                                  |
| `move <from> <to>`       | Move or rename a document, updating incoming Markdown and frontmatter references plus relative references inside it. Preserve unrelated content, refuse destination collisions, and support `--dry-run` previews. |

## Flags

- Global flags work before or after the command: `--root <directory>` overrides root discovery; `--json` returns structured results and diagnostics; `--help` shows general or command help; `--version` prints the CLI version and exits.
- `search` and `list` share `--type <value>` (exact type), `--category <value>` (category segment), `--name <value>` (name segment), `--about <path>` (principal subject), and `--stale`, combined with AND. `list` also supports `--path <glob>` and applies exact filters before limiting. Search uses QMD's native filters and ranking; returned results satisfy filters, but selective queries may underfill QMD's candidate window.
- `search`, `list`, and `related` share `--limit <number>`, requiring a positive safe integer and counting documents for search/list and relationships for related. Lists and relationships are unlimited by default; search retains QMD's native default. Report known truncation; search totals may be unknown.

## Root discovery

Use explicit `--root` directly, resolving relative values from the current directory. Otherwise, look for the nearest `.agent-wiki/` in the current directory or ancestors, stopping after checking the Git working-tree root. Its containing directory becomes the content root. Outside a Git working tree, check only the current directory. Without a match, use the original current directory.

The marker needs no configuration; explicit roots need no marker. Exclude `.agent-wiki/` contents from document discovery. Command paths and globs resolve relative to the content root; authored references resolve relative to their containing document.

Index selections accept files, recursive directories, and quoted globs without
changing that root. Omission reuses saved index selections; `.` explicitly selects
the whole root. New indexes default to the whole root. Empty matches are valid
for indexing so deleted final records can be removed. Status and search currency
inspect the saved selection. If scope state is missing or corrupt beside an
existing index, require an explicit selection for recovery, such as
`wiki index --rebuild records` or `wiki index --rebuild .`; never silently widen it.

## Validation and freshness

Validation checks frontmatter, exactly one H1, internal destinations and heading anchors, and footnote definitions. Report diagnostics with file and line locations. Expand quoted globs within the CLI, deduplicate matches, and reject unmatched selections. Resolve references against the whole wiki even for selected files, such as `wiki validate 'docs/**/*.md' projects/agent-wiki.md`.

`list --stale` is the review queue: show documents due today or earlier, deadlines, and days overdue, ordered most overdue first. Documents without `stale_after` are excluded. Ordinary results include stale documents and identify freshness; staleness is separate from structural errors. Edits never reset freshness automatically.

## Reliability

Authored files remain authoritative; QMD's search index is replaceable derived data. Other read commands use current files. Provide readable output and structured JSON, identifying known indexing gaps and relevant content limitations. Document errors should not block otherwise usable read operations; `validate` returns nonzero for structural errors. Ambiguous aliases report candidates, and operational failures return nonzero. Successful empty results remain distinct from failures. Commands do not fetch external content; only `move` modifies authored files.

Search uses the existing index without indexing first. If stale or incomplete, emit one index-level notice with a `wiki index` recovery instruction, not per-result warnings. A missing index requires explicit indexing. Index currency is separate from document review deadlines.

Search presentation uses QMD's public snippet helper and native chunk selection.
Any snippet positions describe indexed content, not exact original-file lines.
Custom heading breadcrumbs, automatic citation-definition expansion, and exact
source-line mapping are deferred. Use `show` for current document or section
inspection with referenced footnotes. Search does not parse Markdown bodies or
build a reference graph to enrich results.
