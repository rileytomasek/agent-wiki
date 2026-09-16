# Conformance Scenarios

These scenarios make the [document format](document-format.md),
[CLI contract](cli-spec.md), and [architecture](architecture.md) testable. They
are durable behavior examples, not a progress checklist. The normative specs
govern if an example is incomplete. Add executable tests with each behavior under
the [tooling policy](../contributing/tooling.md).

Scenario identifiers group related assertions and are not Linear issue IDs.
Use temporary corpora, explicit clocks, and real filesystem/SQLite integration
where behavior crosses those boundaries.

## Authored content

| Scenario | Input or action                                                                                        | Expected result                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| F01      | Markdown with exactly one H1 and no frontmatter.                                                       | Valid; all metadata absent.                                                                          |
| F02      | Frontmatter containing only a supported subset.                                                        | Valid without other required fields or a type.                                                       |
| F03      | Unknown key, duplicate key, invalid value, or malformed YAML.                                          | Located diagnostics; validation fails. Reads retain unambiguous valid data and readable content.     |
| F04      | Missing H1, two H1s, or an H1-looking line inside fenced code.                                         | Count AST headings only; require exactly one real H1, with a display fallback on errors.             |
| F05      | Tables, task lists, strikethrough, reference links, autolinks, and footnotes.                          | Parse as GFM plus footnotes and preserve body/source locations.                                      |
| F06      | Wikilinks or Obsidian extensions.                                                                      | No wiki-specific interpretation, resolution, or graph edges; these are outside the supported syntax. |
| F07      | Valid/invalid values for every supported scalar, array, date, timestamp, contact, and reference field. | Apply the same format rules on every type; unknown fields never become arbitrary metadata.           |
| F08      | `person`, `entity/project`, a custom category, and a multi-segment value.                              | Preserve the complete open-vocabulary type; derive category/name only from available slash segments. |
| F09      | `/person`, `entity/`, or `entity//person`.                                                             | Empty type segments are invalid.                                                                     |
| F10      | `authors`, `about`, `participants`, or `location` containing a document path.                          | Resolve relative to its containing file; a plain name is not an alias reference.                     |
| F11      | Linked citations with explanatory text, several links, repeated uses, or no links.                     | Preserve text, occurrence context, and definitions; do not invent evidence semantics or targets.     |
| F12      | Footnotes outside a Sources heading, or a Sources heading with ordinary links.                         | Same structural behavior regardless of heading label.                                                |
| F13      | References inside fenced code or raw HTML attributes.                                                  | No Markdown graph edges from code; the initial resolver does not interpret HTML attributes.          |
| F14      | CRLF, Unicode before references, escapes, or percent-encoded destinations.                             | Correct original string spans and one-based locations; no byte/string offset confusion.              |

Use invalid fixtures as data, for example:

```markdown
---
type: entity/person
custom_status: active
email: not-an-email
---

# Alex

This readable body is still useful.
```

This fixture has independent unknown-key and email-value diagnostics. It belongs
in a test data directory, not the valid example wiki.

## Roots, discovery, and cache

| Scenario | Input or action                                                                      | Expected result                                                                                      |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| W01      | Explicit absolute/relative `--root`.                                                 | Use it directly; relative root resolves from invocation directory.                                   |
| W02      | Nested markers inside a Git working tree.                                            | Choose the nearest marker, checking the Git root inclusively and never searching above it.           |
| W03      | No marker, or invocation outside a Git working tree.                                 | Fall back to original current directory; outside Git inspect only that directory for a marker.       |
| W04      | Root read without a marker.                                                          | Operate in memory; do not create a marker and alter future discovery.                                |
| W05      | Cache/dependency/build directories, directory symlinks, and links escaping the root. | Follow the shared discovery policy; never ingest outside-root sources or derived cache content.      |
| W06      | Linked non-Markdown attachment.                                                      | Resolve as an attachment without requiring frontmatter or a title.                                   |
| W07      | Unchanged content, changed content, or same-size edit with preserved mtime.          | Content hashes and parser/schema versions determine cache reuse.                                     |
| W08      | Corrupt/missing/incompatible cache or optional cache-write failure.                  | Reconstruct usable data; optional cache persistence does not block reads.                            |
| W09      | Confirmed deletion versus incomplete directory scan.                                 | Drop confirmed removals only; do not infer absence from unvisited paths.                             |
| W10      | Unreadable file with an older cached/indexed copy.                                   | Report incomplete coverage; do not present the older record as a successful current read.            |
| W11      | Changed discovery/parser/projection versions or QMD build.                           | Invalidate the relevant derived state/currency claims; never claim unknown compatibility is current. |

## Resolution and read operations

| Scenario | Input or action                                                            | Expected result                                                                                             |
| -------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R01      | Relative, fragment-only, escaped, or encoded local destination.            | Resolve against the source document with shared root/path rules.                                            |
| R02      | Duplicate heading text and section links.                                  | Use one GitHub-compatible anchor algorithm consistently for show, graph, validation, and moves.             |
| R03      | Missing document/attachment/heading or missing footnote definition.        | Keep authored occurrences and report located unresolved diagnostics.                                        |
| R04      | Two files share an alias or basename.                                      | Paths retain identity; alias ambiguity returns candidates without selecting one.                            |
| R05      | Several links to one destination, including shared definitions.            | Preserve occurrences and use sites; a shared editable destination is represented once for patching.         |
| R06      | Body link, image, citation link, named reference field, and primary `url`. | Preserve relationship origins and source locations; do not conflate them.                                   |
| R07      | Two documents link to one recognized GitHub resource.                      | One external target with incoming references; no network request or fabricated remote state.                |
| R08      | Distinct hosts/namespaces, generic queries/fragments, and `mailto:`.       | Preserve resource identity conservatively and retain authored URLs/selectors.                               |
| R09      | `show` by path/anchor or unique alias.                                     | Read current source with heading context and referenced footnote definitions.                               |
| R10      | `list` with combined exact filters and a limit.                            | Filter before limiting; sort paths deterministically; support type/category/name/about and list path globs. |
| R11      | `related` for a document, section, attachment, or external URL.            | Return immediate incoming/outgoing occurrences, including section references at document level.             |
| R12      | `validate` with no selection.                                              | Validate the whole wiki and fail for structural errors or incomplete operational coverage.                  |
| R13      | Selected files/directories/quoted globs, overlaps, or no matches.          | Expand and deduplicate; fail unmatched selections; resolve against the entire wiki.                         |
| R14      | Selected file links to an unselected document.                             | Resolve the target correctly; report document diagnostics for the selected scope.                           |

## Review deadlines

| Scenario | Input or action                                                         | Expected result                                                                                 |
| -------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| T01      | Deadline yesterday, today, tomorrow, or absent under an injected clock. | Yesterday/today are stale; tomorrow is not; absent means no declared deadline.                  |
| T02      | `list --stale` with several overdue documents.                          | Exclude undated/future documents; order oldest deadline first, then path; show days overdue.    |
| T03      | Edit or index a due document.                                           | Deadline remains unchanged; no implicit review occurs.                                          |
| T04      | A due document is otherwise valid.                                      | Ordinary search/show keep it visible; structural validation does not fail merely for staleness. |
| T05      | Operation spans local midnight.                                         | All review comparisons use one invocation-wide calendar date.                                   |

## QMD projection, index, and search

| Scenario | Input or action                                                         | Expected result                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01      | Project valid source metadata and body.                                 | Deterministic `qmd.metadata`, original path/title/body-line mapping, root-normalized references, unchanged body and footnotes.                                                                |
| Q02      | Invalid metadata, missing title, or values exceeding QMD limits.        | Use tolerant data; omit unusable search metadata with diagnostics. QMD limits do not redefine document validity.                                                                              |
| Q03      | Repeat projection without source changes.                               | Identical output bytes and no unnecessary mirror rewrite or indexing timestamps.                                                                                                              |
| Q04      | Index two independent wiki roots.                                       | Dedicated databases/inline collections; no global QMD config or private-table writes.                                                                                                         |
| Q05      | First/no-op/edit/add/delete update cycles.                              | Correct complete-collection reconciliation; confirmed deletions removed and unchanged content reused.                                                                                         |
| Q06      | Source temporarily unreadable or scan incomplete.                       | Preserve prior indexed copies where appropriate and report incomplete coverage without claiming success.                                                                                      |
| Q07      | Content update succeeds but embedding generation fails.                 | Preserve useful indexed text, report pending work and failure, and retry missing embeddings later.                                                                                            |
| Q08      | Process interruption at each indexing stage.                            | State stays inspectable; next explicit index safely retries; completed baselines are not fabricated.                                                                                          |
| Q09      | `index --rebuild`.                                                      | Recreate search-derived state without changing authored files or deleting separate future observations.                                                                                       |
| Q10      | `status` on missing, current, stale, incomplete, or incompatible state. | Report availability/currency/coverage/problems without initializing an index or loading inference models.                                                                                     |
| Q11      | Search with no index.                                                   | Actionable nonzero error directing the user to `wiki index`; no implicit build.                                                                                                               |
| Q12      | Search after edit/add/delete or with partial embedding coverage.        | Existing snapshot results plus at most one index-level stale/incomplete notice, represented once in JSON.                                                                                     |
| Q13      | Combined type/category/name/about/stale filters.                        | Use QMD native conditions; every returned hit matches. Bounded candidate windows may underfill.                                                                                               |
| Q14      | Selective search with a result limit.                                   | Count documents; preserve ranking; no fabricated exhaustive total or repeated post-filter retrieval loop.                                                                                     |
| Q15      | Indexed hit with headings, citations, Unicode, and moved source.        | Use QMD's public snippet helper with indexed body/native chunk inputs and exact original indexed path. No custom headings, appended definitions, or per-result current-source reconciliation. |
| Q16      | Hit entirely in generated metadata.                                     | Preserve the native snippet. Omit positions or explicitly label them as indexed-content positions; never promise exact original-file locations.                                               |
| Q17      | Run show/list/related/validate with search unavailable.                 | Current-content operations do not depend on QMD/model initialization.                                                                                                                         |

## Safe moves

| Scenario | Input or action                                                                   | Expected result                                                                                                                      |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| M01      | Move a document across directories.                                               | Update incoming Markdown and named field paths plus outgoing relative destinations, including attachments, sections, and self-links. |
| M02      | Reference definitions, citations, YAML scalar styles, CRLF, and repeated uses.    | Edit exact destination spans once; retain labels, keys, fragments, comments, and unrelated bytes.                                    |
| M03      | `move --dry-run`.                                                                 | Full path/content preview and no authored changes.                                                                                   |
| M04      | Destination collision, root escape, ambiguous source, or overlapping patch spans. | Refuse before changing authored content.                                                                                             |
| M05      | An unrelated title error versus an unreadable/reference-unparseable file.         | Tolerate unrelated diagnostics; refuse when complete reference preservation cannot be established.                                   |
| M06      | Concurrent source edit after planning or newly occupied destination.              | Recheck hashes/conditions and refuse stale edits.                                                                                    |
| M07      | Write failure during a multi-file move.                                           | Attempt rollback from temporary originals and report exact partial outcome; no false atomic-success claim.                           |
| M08      | Case-only rename on a case-insensitive filesystem.                                | Correct filename and references without collision/data loss.                                                                         |
| M09      | Index/move overlap.                                                               | Serialize through the workspace lock; handle interruption/recovery without silent lock bypass.                                       |
| M10      | Successful move followed by reads/search.                                         | Current graph/cache reflect the move; search remains an indexed snapshot with one currency notice until reindexed.                   |

## CLI and package

| Scenario | Input or action                                                                   | Expected result                                                                                                                     |
| -------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| C01      | Global flags before/after commands and command help/version.                      | Consistent parsing and executable behavior.                                                                                         |
| C02      | Invalid arguments, ambiguous requested target, failed operation, or empty result. | Useful diagnostics and correct nonzero failures; successful empty results are distinct.                                             |
| C03      | JSON output during progress or partial results.                                   | One valid structured result on stdout; progress does not corrupt it.                                                                |
| C04      | Limits on list/search/related.                                                    | Correct document/relationship units and known truncation, with unknown search totals allowed.                                       |
| C05      | Packed library and CLI in a fresh Node consumer outside the checkout.             | Imports, declarations, help/version, and representative commands work without Bun globals or development tools.                     |
| C06      | Every authored TypeScript area and every production source file.                  | Strict checking includes production source, tests, fixture builders, configuration files, and scripts.                              |
| C07      | Local hooks, CI, minimum/development Node, Linux/macOS.                           | Shared scripts enforce the same policy; report actual local/remote/platform evidence separately.                                    |
| C08      | Fresh Bun consumer with isolated dependency installation.                         | Public declarations, all eight CLI commands, metadata filters, index/search/move, and explicit model proofs work with prebuilt QMD. |

Add property tests for path normalization, graph consistency, deterministic
projection, and move invariants with replayable seeds. Keep normal tests offline
after dependencies are installed. Verify real embeddings and hybrid search in a
separate model-dependent smoke test when QMD or semantic integration changes.
