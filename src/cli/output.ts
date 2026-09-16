import type { Diagnostic } from '../documents/types.ts';
import { OperationError } from '../operations/errors.ts';
import type {
  DocumentInfo,
  ListResult,
  ShowResult,
} from '../operations/types.ts';

export interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export function information(
  text: string,
  json: boolean,
  key: string
): CliResult {
  const stdout = json ? JSON.stringify({ [key]: text, diagnostics: [] }) : text;
  return { stdout: `${stdout}\n`, stderr: '', exitCode: 0 };
}

export function failure(error: unknown, json: boolean): CliResult {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof OperationError ? error.code : 'cli_error';
  const candidates = error instanceof OperationError ? error.candidates : [];
  const result = {
    diagnostics: [{ code, severity: 'error', message, path: '' }],
    ...(candidates.length === 0 ? {} : { candidates }),
  };
  if (json)
    return { stdout: `${JSON.stringify(result)}\n`, stderr: '', exitCode: 1 };
  const details =
    candidates.length === 0 ? '' : `\nCandidates:\n${candidates.join('\n')}\n`;
  return { stdout: '', stderr: `wiki: ${message}\n${details}`, exitCode: 1 };
}

function diagnosticText(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((item) => {
      const position =
        item.span === undefined
          ? item.path
          : `${item.path}:${item.span.line}:${item.span.column}`;
      return `${position}: ${item.code}: ${item.message}\n`;
    })
    .join('');
}

function reviewLabel(document: DocumentInfo): string {
  const review = document.review;
  if (!review.stale) return '';
  return ` [review due ${review.deadline ?? ''}; ${review.daysOverdue ?? 0} days overdue]`;
}

export function renderList(result: ListResult, json: boolean): CliResult {
  const lines = result.documents.map(
    (document) =>
      `${document.path}\t${document.title}\t${document.metadata.type ?? ''}${reviewLabel(document)}`
  );
  if (result.truncated)
    lines.push(
      `Showing ${result.documents.length} of ${result.total} documents.`
    );
  return rendered(
    result,
    json ? JSON.stringify(result) : lines.join('\n'),
    json
  );
}

export function renderShow(result: ShowResult, json: boolean): CliResult {
  const content = `${result.document.path}${reviewLabel(result.document)}\n\n${result.content}`;
  return rendered(result, json ? JSON.stringify(result) : content, json);
}

export function rendered(
  result: {
    readonly diagnostics: readonly Diagnostic[];
    readonly complete: boolean;
  },
  text: string,
  json: boolean
): CliResult {
  return {
    stdout: text === '' || text.endsWith('\n') ? text : `${text}\n`,
    stderr: json ? '' : diagnosticText(result.diagnostics),
    exitCode: result.complete ? 0 : 1,
  };
}
