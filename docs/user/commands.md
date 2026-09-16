# Commands

`show` and `list` read current files and work before search indexing is available.
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
wins when it exists; `#heading` selects a heading anchor otherwise. Filenames are
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

## JSON and failures

`--json` writes one structured result to stdout, including diagnostics. Text
output writes diagnostics to stderr. Successful empty lists exit zero. Content
diagnostics do not make an otherwise useful read fail; invalid arguments,
ambiguous/missing targets, and incomplete filesystem reads exit nonzero.

Excluded directories, hidden content, directory symlinks, and outside-root paths
are not wiki documents, including when requested explicitly. Search availability
does not affect these commands.
