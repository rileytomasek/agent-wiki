# Document Format

Agreed Markdown document format. This specifies authoring and validation, not an implemented tool.

See the [CLI functional spec](cli-spec.md), [architecture](architecture.md), and [repository setup and code-quality decisions](../contributing/tooling.md) for the tool that maintains and searches these files.

## Content

- Use GitHub Flavored Markdown with footnotes and standard Markdown links; no wikilinks or Obsidian-specific syntax.
- Require exactly one H1 title per indexed Markdown document. Other headings and body structure are optional; no required introduction, sections, or template. Attachments are exempt.
- Use paths relative to the containing document for internal links, optionally with heading anchors, and ordinary URLs for external links.
- Recommend footnotes with links for citations, with footnote definitions grouped under a `## Sources` heading at the end of the document. This is a best practice, not a requirement; the heading has no special semantics. Preserve explanatory text and qualifications; a citation does not automatically establish support.
- Use the path relative to the configured content root as document identity. Moves and renames require updating incoming references.

## Frontmatter

YAML frontmatter is optional. All supported fields are optional and available on every document, regardless of `type`. Each field has one meaning and value format across all types.

| Field | Format | Meaning |
| --- | --- | --- |
| `type` | Nonempty string; conventionally `category/name` | Descriptive classification, such as `entity/person`, `event/meeting`, or `doc/guide`; no registration required. |
| `aliases` | List of nonempty strings | Alternative names for document lookup; links still target paths. |
| `about` | List of relative paths to Markdown documents | Principal subjects, resolved relative to the containing document. |
| `stale_after` | Valid ISO calendar date, `YYYY-MM-DD` | Date on which review becomes due and freshness becomes unverified. |
| `url` | Absolute HTTP(S) URL | Primary external page for the document or thing it describes; supporting sources remain citations. |
| `email` | Email address string | Primary contact email. |
| `phone` | Nonempty string | Primary contact number; international format is recommended, but extensions and local formatting are allowed. |
| `address` | Nonempty string; multiline allowed | Physical or postal address. |
| `starts_at` | Calendar date or timestamp with timezone | Start of the described event or period. |
| `ends_at` | Calendar date or timestamp with timezone | End of the described event or period. |
| `published_at` | Calendar date or timestamp with timezone | Publication date of the described work or document. |
| `authors` | List of relative paths to Markdown documents | People or organizations credited with authorship. |
| `participants` | List of relative paths to Markdown documents | People or organizations participating in the described event or activity. |
| `location` | Relative path to a Markdown document | Place where the described thing is located or occurs. |

- Document references in `about`, `authors`, `participants`, and `location` resolve relative to the containing document. Do not mix plain names and paths; unlinked names belong in the body.
- Dates use valid `YYYY-MM-DD` calendar dates or, where permitted, ISO timestamps with an explicit UTC offset or `Z`, such as `2026-09-15T14:00:00-04:00`. Preserve known precision; do not invent a time for a date-only value.
- Singular contact fields describe primary contact information. Additional contact details belong in the body.
- Fields describe the document or its subject, not filesystem activity. Editing a book note does not change the book's `published_at`.
- Unknown keys, duplicate keys, malformed YAML, invalid field values, and missing or multiple H1 titles are errors. Ambiguous aliases must not silently resolve to one document.
- `type` is a label, not a schema discriminator: it neither requires nor restricts other fields. There is no type registry or type-specific field inheritance.

## Type convention

- Prefer `category/name`: the complete string is the **type**, the first segment is the **category**, and the second is the **name**. These are parts of one value, not separate frontmatter fields.
- Suggested categories are `entity` (identifiable things), `concept` (abstract subjects), `event` (occurrences or bounded experiences), and `doc` (documents classified by purpose or form).
- Prefer two lowercase segments, using hyphens for multiple words. Categories and names are open vocabulary; plain values such as `person` and custom categories remain valid. Slash-separated values must have nonempty segments: `/person`, `entity/`, and `entity//person` are invalid.
- Classify what the file primarily represents. Use `about` for its subjects. Categories do not impose directory layouts or field requirements.
- See [type examples and useful frontmatter](../user/type-examples.md) for illustrative names and distinctions.

## Freshness

- A document is stale on and after `stale_after`; omission means no freshness deadline is declared.
- Edits do not reset freshness automatically. A substantive review may update or remove the date.
- Staleness does not establish incorrectness or structural invalidity. Keep freshness and structural validation separate.
- Surface stale status in search and inspection and support listing overdue documents. Workflows may require freshness; ordinary search must not silently hide stale documents.
