import type { ReviewStatus } from '../documents/dates.ts';
import type {
  SearchDocument,
  WikiSearchResult,
} from '../search/query-types.ts';
import type { CliResult } from './output.ts';

function reviewLabel(review: ReviewStatus): string {
  return review.stale
    ? ` [review due ${review.deadline ?? ''}; ${review.daysOverdue ?? 0} days overdue]`
    : '';
}

function documentText(document: SearchDocument): string {
  const type = document.metadata['type'];
  const typeLabel = typeof type === 'string' ? `\t${type}` : '';
  return `${document.path}\t${document.title}${typeLabel}\t(score ${document.score})${reviewLabel(document.review)}\nIndexed snippet:\n${document.snippet.text}`;
}

export function renderSearch(
  result: WikiSearchResult,
  json: boolean
): CliResult {
  const text = json
    ? JSON.stringify(result)
    : result.documents.map((document) => documentText(document)).join('\n\n');
  return {
    stdout: text === '' ? '' : `${text}\n`,
    stderr:
      json || result.indexNotice === null
        ? ''
        : `${result.indexNotice.message}\n`,
    exitCode: result.complete ? 0 : 1,
  };
}
