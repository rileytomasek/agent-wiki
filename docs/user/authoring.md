# Authoring an Agent Wiki

An Agent Wiki is a directory of Markdown documents connected by ordinary links.
Start with one H1 title and useful content; frontmatter is optional:

```markdown
# Website

The website introduces our project and explains how to get involved.
```

Use GitHub Flavored Markdown with footnotes. Tables, lists, code blocks, and
ordinary Markdown links work. Wikilinks and Obsidian-specific syntax are outside
the format. The [document format](../design/document-format.md) is the
authoritative list of supported fields and validation rules.

## Add metadata when it is useful

Every supported field is optional and has the same meaning on every document.
Unknown fields are errors, so put free-form details in the body.

```markdown
---
type: entity/person
aliases:
  - Alex
email: alex@example.com
---

# Alex Rivera

Alex maintains the [website](../projects/website.md).
```

`type` describes what the file represents. Prefer `category/name`, such as
`entity/project`, `concept/method`, `event/meeting`, or `doc/guide`. The
vocabulary is open and does not enable additional metadata. See
[type examples](type-examples.md) for distinctions and useful shared fields.

## Connect documents

A document's identity is its path within the wiki. Write links relative to the
containing document, such as `[Website](../projects/website.md)` or
`[Deployment](../guides/deployment.md#deploy)`. Aliases are lookup conveniences;
they do not replace path destinations.

Use `about` for principal subjects. A guide about the website can use:

```yaml
type: doc/guide
about:
  - ../projects/website.md
authors:
  - ../people/alex.md
```

The reference fields `about`, `authors`, `participants`, and `location`
contain relative document paths. An unlinked name belongs in the body.
Additional contact information and narrative relationships also belong there.

## Cite sources

Footnotes keep evidence close to the claims it qualifies. We recommend placing
definitions under `## Sources` at the end, but that heading is optional and has
no special behavior.

```markdown
# Deployment guide

This workflow follows the published deployment notes.[^deployment]

## Sources

[^deployment]:
    [Deployment notes](https://example.com/deployment).
    This source describes the original process; local settings may differ.
```

Keep useful explanations and qualifications in the footnote. A citation records
a reference; it does not prove the claim automatically. A document's `url`
identifies its primary external page, while supporting evidence belongs in
citations.

## Declare a review deadline

Use `stale_after: '2026-12-01'` when the document should be reviewed on or after
that date. Omit it when there is no known deadline. A due document remains
readable and searchable, and its deadline does not imply its content is wrong.

The `wiki list --stale` command lists overdue documents. Editing or
reindexing will not reset the deadline; update or remove it after an actual review.
Search-index currency is separate: the `wiki index` command refreshes
search after content changes.

For a connected example, read the [example wiki](../../examples/wiki/README.md).
The CLI behavior is specified in the [functional spec](../design/cli-spec.md);
consult the repository [README](../../README.md) for implementation availability.
