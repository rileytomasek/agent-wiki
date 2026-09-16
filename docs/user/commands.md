# Commands

`show`, `list`, `related`, and `validate` read current files and work before
search indexing is available.
During development, build with `mise exec -- bun run build` and run
`mise exec -- node dist/cli/bin.js` in place of `wiki` below. See the repository
[setup instructions](../../README.md#development-setup).

## Select a wiki

Use `--root <directory>` to choose the content root. Otherwise, `wiki` uses the
nearest `.agent-wiki` marker within the current Git working tree, or the current
directory when there is no marker. Outside Git, only the current directory is
considered. Reading does not create a marker.

Global `--root`, `--json`, `--help`, and `--version` flags work before or after
the command. Use `--` before a target beginning with `-`.

## Read a document or section

```sh
wiki --root examples/wiki show guides/deployment.md
wiki show 'guides/deployment.md#deploy' --root examples/wiki
```

Targets are exact root-relative paths or declared aliases. A literal filename
wins when it exists, followed by a real document path with a `#heading` anchor.
Otherwise, an exact declared alias wins before interpreting an alias with a
heading suffix. Filenames are
not URI-decoded. Ambiguous aliases report all candidate paths. Lookup does not
guess files from their basenames.

A whole-document result contains the current source, including YAML. A section
includes its ancestor headings and any footnote definitions referenced by the
displayed content, without repeating definitions already present. Malformed
metadata produces diagnostics while usable content remains visible.

## Filter documents

```sh
wiki list --root examples/wiki --category entity
wiki list --root examples/wiki --type doc/guide --about projects/website.md
wiki list --root examples/wiki --path 'guides/**/*.md' --limit 5 --json
wiki list --root examples/wiki --stale
```

`--type`, `--category`, `--name`, `--about`, `--path`, and `--stale` combine with
AND and apply before `--limit`. Types and segments compare exactly. The subject
passed to `--about` is a literal path relative to the wiki root; authored YAML
references are relative to their containing document. Quote path globs so the
CLI receives the pattern.

Lists sort by path and are unlimited by default. An explicit limit must be a
positive integer. Truncated lists report the number of matching readable
documents. `--stale` selects deadlines today or earlier, orders oldest first,
and reports overdue days. Undated documents stay out of the review queue.
Editing a file does not reset its deadline.

## Build and inspect the search index

```sh
wiki index --root examples/wiki
wiki status --root examples/wiki --json
wiki index --root examples/wiki --rebuild
```

`index` creates a dedicated search index and generates missing embeddings using
QMD's local models. The first embedding run may download those models. Indexing
is explicit; ordinary reads and status never start it. Authored files remain
unchanged. Repeating the command reuses unchanged generated files and text.

`status` reports whether the index exists, whether source files changed, the
last text update, and recorded embedding work. Counts include their observation
time; status does not reopen QMD or load inference models. Content currency and
embedding completion are separate: searchable text can be current while
embeddings are still pending. A due review deadline is a third, independent
condition.

Unreadable files retain their previous indexed copies. Indexing reports partial
coverage and exits nonzero; restore readable sources and run `wiki index` again.
Failed embedding work also leaves useful text and can be retried with the same
command. `--rebuild` recreates only search-derived files, requires complete
readable source coverage, and preserves separate external observations.

Writers share an exclusive lock. After an interrupted process, inspect the PID
and host in `.agent-wiki/cache/write.lock`. Confirm that the owner has stopped
before removing that abandoned lock. For an interrupted move, first inspect and
restore any retained originals described below. Existing locks are never stolen
by a timer or another process.

## Search the indexed snapshot

```sh
wiki search 'deployment rollback' --root examples/wiki
wiki search 'website' --root examples/wiki --type doc/guide --limit 5 --json
wiki search 'website' --root examples/wiki --about projects/website.md --stale
```

Search uses QMD's native hybrid ranking, scores, and snippets. Exact `--type`,
`--category`, `--name`, `--about`, and `--stale` filters combine with AND. A limit
counts documents; without one, QMD's default applies. Selective filters can return
fewer documents than the limit because retrieval uses a bounded candidate window.
Search has no path-glob filter, and JSON reports unknown totals as `null`.

Results retain the original indexed paths, titles, metadata, and review dates.
Native snippets may include generated metadata; their header positions refer to
indexed content. Use `show` for current text, section context, and referenced
footnotes. After editing or moving files, snapshot hits remain usable and one
index-level notice directs you to `wiki index`. Search never refreshes documents
or the index implicitly. Query embedding and reranking can load QMD's local models.

## Inspect references

```sh
wiki related projects/website.md --root examples/wiki
wiki related 'guides/deployment.md#deploy' --root examples/wiki --json
wiki related 'https://github.com/owner/repo/pull/12' --limit 10
```

Relationships preserve the authored link, citation use, or frontmatter field and
its source location. Document lookup includes references to its sections; a
section lookup narrows the relationships. Attachments and external URLs are
addressable targets. No remote content is fetched, and a citation is not a claim
that its destination supports the surrounding text.

The default is unlimited; `--limit` counts relationships. A self-reference is
reported once with direction `both`. Unresolved outgoing destinations remain
visible with diagnostics. Declared aliases are lookup conveniences; authored
references resolve paths, never aliases.

## Validate current content

```sh
wiki validate --root examples/wiki
wiki validate guides projects/website.md --root examples/wiki
wiki validate 'guides/**/*.md' --root examples/wiki --json
```

Without selections, validation covers every discovered document. Files,
recursive directories, and quoted globs can be combined; overlapping selections
are deduplicated. A selection with no matches is an error. References always
resolve against the whole wiki, while document diagnostics are limited to the
selected files. Structural errors or incomplete filesystem coverage exit
nonzero. A shared alias is ambiguous when looked up; sharing an alias does not
by itself invalidate either document.

## Move a document

```sh
wiki move guides/deployment.md playbooks/deploy.md --root examples/wiki --dry-run
wiki move guides/deployment.md playbooks/deploy.md --root examples/wiki
wiki move 'Deployment Guide' playbooks/deploy.md --json
```

The source is a whole document path or an unambiguous declared alias. The
destination is a visible root-relative `.md` path. Preview shows every path and
the complete before/after content changes. JSON includes original and proposed
source, exact edits, and hashes, so library callers can review and apply the same
plan. Dry-run creates no authored files or destination directories.

Moves update incoming links and named frontmatter fields, then rebase outgoing
relative links from the document's new location. Attachments, sections,
self-links, shared definitions, and citations keep their targets. Labels,
fragment spelling, comments, scalar styles, and unrelated source stay intact.
Search remains on its indexed snapshot until `wiki index` runs again.

Collisions, root escapes, ambiguous sources, incomplete reads, and reference
syntax that cannot be rewritten exactly are refused. Unrelated title and value
errors remain diagnostics. YAML anchors/aliases in reference fields and new
paths that cannot retain an existing scalar style require an author edit before
moving. Authored file symlinks and symlinked parents are refused for mutations.
A move also refuses discovered file symlinks pointing at any moved or rewritten
source, since their relative references could change meaning. Symlinks to
unaffected files do not prevent moving.

A multi-file move can fail after some writes. The command attempts rollback and
reports `rolled-back` or `partial`, exits nonzero, and lists current states for
all affected paths. `original` and `planned` describe matching content;
`changed`, `missing`, and `unreadable` expose other observed outcomes. Retained
recovery files are listed explicitly. Backup names include the original filename,
for example `.guide.md.wiki-move-<token>.backup` beside the original location.
After an interrupted move, inspect those originals and `.stage` replacements
before restoring files and clearing the abandoned writer lock. Never overwrite
newer content during manual recovery.

## JSON and failures

`--json` writes one structured result to stdout, including diagnostics. Text
output writes diagnostics to stderr. Successful empty lists exit zero. Content
diagnostics do not make an otherwise useful read fail; invalid arguments,
ambiguous/missing targets, and incomplete filesystem reads exit nonzero.

Excluded directories, hidden content, directory symlinks, and outside-root paths
are not wiki documents, including when requested explicitly. Search availability
does not affect these commands.
