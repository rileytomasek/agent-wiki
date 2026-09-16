import type {
  RelatedResult,
  ValidationResult,
} from '../operations/reference-results.ts';
import type {
  ReferenceOccurrence,
  ReferenceTarget,
} from '../references/types.ts';
import { rendered } from './output.ts';
import type { CliResult } from './output.ts';

function targetText(target: ReferenceTarget): string {
  if (target.kind === 'external') return target.url;
  return target.path + (target.anchor === undefined ? '' : `#${target.anchor}`);
}

function occurrenceText(occurrence: ReferenceOccurrence): string {
  const { reference, use, sourcePath, resolution } = occurrence;
  const position =
    use === undefined ? sourcePath : `${sourcePath}:${use.line}:${use.column}`;
  const field = reference.field === undefined ? '' : `.${reference.field}`;
  const citation =
    reference.citation === undefined ? '' : ` [^${reference.citation}]`;
  const state =
    resolution.status === 'resolved' ? '' : ` [${resolution.reason}]`;
  return `${position} ${reference.origin}${field}${citation} -> ${reference.destination}${state}`;
}

export function renderRelated(result: RelatedResult, json: boolean): CliResult {
  const lines = [
    targetText(result.target),
    ...result.relationships.map(
      (relationship) =>
        `${relationship.direction} ${occurrenceText(relationship.occurrence)}`
    ),
  ];
  if (result.truncated)
    lines.push(
      `Showing ${result.relationships.length} of ${result.total} relationships.`
    );
  return rendered(
    result,
    json ? JSON.stringify(result) : lines.join('\n'),
    json
  );
}

export function renderValidation(
  result: ValidationResult,
  json: boolean
): CliResult {
  const errors = result.diagnostics.filter(
    (item) => item.severity === 'error'
  ).length;
  const summary = `Validated ${result.selectedPaths.length} documents; ${errors} errors.${result.complete ? '' : ' Coverage is incomplete.'}`;
  return rendered(
    {
      diagnostics: result.diagnostics,
      complete: result.complete && result.valid,
    },
    json ? JSON.stringify(result) : summary,
    json
  );
}
