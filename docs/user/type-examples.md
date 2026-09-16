# Agent Wiki Type Examples

Companion to the [Agent Wiki spec](../design/document-format.md). Types conventionally use `category/name`. These examples are suggestions, not an exhaustive list or reserved vocabulary. Every supported frontmatter field remains optional and available to every type.

## Categories and names

| Category  | Example names                                                                                         | Represents                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `entity`  | `person`, `organization`, `place`, `project`, `product`, `service`, `book`, `dataset`                 | An identifiable thing, including an ongoing project or published work.  |
| `concept` | `topic`, `theory`, `method`, `principle`, `pattern`, `value`                                          | An abstract subject that other documents can discuss or reference.      |
| `event`   | `meeting`, `conference`, `trip`, `appointment`, `incident`, `milestone`                               | A particular occurrence or bounded experience, whether planned or past. |
| `doc`     | `guide`, `reference`, `research`, `proposal`, `decision`, `spec`, `report`, `review`, `idea`, `index` | A document classified by its purpose or form.                           |

## Useful shared frontmatter

These pairings use fields already supported by the spec. Include only information that is known and useful; the type does not require any of it. Reference fields contain paths to Markdown documents, not plain names.

| Types                                                    | Useful fields                                                      | Usage                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `entity/person`, `entity/organization`                   | `aliases`, `url`, `email`, `phone`, `address`, `location`          | Primary contact information; `location` can link to a place record.                                                       |
| `entity/place`                                           | `aliases`, `url`, `address`, `phone`                               | Identify and locate a place.                                                                                              |
| `entity/project`                                         | `url`, `about`, `starts_at`, `ends_at`, `stale_after`              | Project homepage, principal subjects, known project dates, and overview review deadline.                                  |
| `entity/product`, `entity/service`                       | `url`, `aliases`, `stale_after`                                    | Primary product or service page and a deadline for reviewing changing details.                                            |
| `entity/book`, `entity/dataset`                          | `authors`, `published_at`, `url`, `about`                          | Attribution, publication date, primary external page, and subjects.                                                       |
| `concept/*`                                              | `aliases`, `about`, `stale_after`                                  | Alternative terminology, principal subjects, and an optional review deadline. Supporting sources remain linked citations. |
| `event/meeting`, `event/conference`, `event/appointment` | `starts_at`, `ends_at`, `participants`, `location`, `url`, `about` | Timing, attendees, venue, event page, and subjects.                                                                       |
| `event/trip`, `event/incident`, `event/milestone`        | `starts_at`, `ends_at`, `participants`, `location`, `about`        | Known timing, involved people or organizations, and context; omit an end for an instantaneous milestone.                  |
| `doc/guide`, `doc/reference`, `doc/spec`                 | `about`, `authors`, `url`, `stale_after`                           | Subjects, authorship, primary external page when applicable, and freshness deadline.                                      |
| `doc/proposal`, `doc/decision`, `doc/idea`               | `about`, `authors`, `published_at`                                 | The project or subjects addressed, authorship, and publication date if applicable.                                        |
| `doc/research`, `doc/report`, `doc/review`               | `about`, `authors`, `published_at`, `stale_after`                  | Subjects, attribution, publication date, and review deadline. Supporting evidence belongs in citations.                   |
| `doc/index`                                              | `about`, `stale_after`                                             | Scope and review deadline; organize links in the body.                                                                    |

Here `concept/*` means any name under the suggested `concept` category; it is table shorthand, not a literal type value.

## Choosing a type

| File                                       | Type             | Distinction                                                                                           |
| ------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Agent Wiki project overview                | `entity/project` | Represents the ongoing project itself.                                                                |
| Proposed Agent Wiki search design          | `doc/proposal`   | Proposes a change; `about` points to the project.                                                     |
| Agent Wiki format specification            | `doc/spec`       | Defines a contract; `about` points to the project.                                                    |
| Record describing a particular book        | `entity/book`    | Represents the published work, including its authors and publication date.                            |
| Your review of that book                   | `doc/review`     | Evaluates the work; `about` points to the book. Its authors and publication date describe the review. |
| Spaced repetition                          | `concept/method` | Describes the method as a subject.                                                                    |
| How to study using spaced repetition       | `doc/guide`      | Provides instructions; `about` points to the method.                                                  |
| September project review meeting and notes | `event/meeting`  | Represents a particular meeting, including its participants and dates.                                |
| Reusable project review agenda             | `doc/reference`  | Provides a reusable document rather than representing a particular meeting.                           |

Choose the type for what the file primarily represents, and use `about` to identify its subjects. A project can have proposals, meetings, guides, and reports without those all becoming `entity/project`. Being used as a source does not change a record's type; books, meetings, and reports can all provide evidence.
