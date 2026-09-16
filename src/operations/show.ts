import { invocationDate } from '../documents/dates.ts';
import { lookupDocument } from './lookup.ts';
import { documentInfo } from './results.ts';
import { sectionContent } from './show-content.ts';
import type { ReadOptions, ShowResult } from './types.ts';

export async function showDocument(
  root: string,
  target: string,
  options: ReadOptions = {}
): Promise<ShowResult> {
  const today = invocationDate(options.clock);
  const { snapshot, section } = await lookupDocument(root, target);
  const content =
    section === undefined
      ? {
          content: snapshot.source,
          headingContext: [],
          footnotes: snapshot.document.footnotes,
        }
      : sectionContent(snapshot, section);
  return {
    document: documentInfo(snapshot.document, today),
    ...(section === undefined ? {} : { section }),
    ...content,
    diagnostics: snapshot.document.diagnostics,
    complete: true,
  };
}
