import type { MoveFileChange, MovePlan } from './types.ts';

function lines(source: string): readonly string[] {
  const result = source.split('\n');
  return source.endsWith('\n') ? result.slice(0, -1) : result;
}

function marked(source: string, marker: string): string {
  const content = lines(source)
    .map((line) => marker + line)
    .join('\n');
  const ending = source.endsWith('\n') ? '' : '\\ No newline at end of file\n';
  return `${content}\n${ending}`;
}

function fileDiff(change: MoveFileChange): string {
  const rename =
    change.path === change.destination
      ? ''
      : `rename from ${JSON.stringify(change.path)}\nrename to ${JSON.stringify(change.destination)}\n`;
  if (change.before === change.after) return rename;
  const headers = `--- ${JSON.stringify(change.path)}\n+++ ${JSON.stringify(change.destination)}\n`;
  const range = `@@ -1,${lines(change.before).length} +1,${lines(change.after).length} @@\n`;
  return (
    rename +
    headers +
    range +
    marked(change.before, '-') +
    marked(change.after, '+')
  );
}

/** Complete before/after hunks; exact structured edits remain available in the plan. */
export function formatMoveDiff(plan: MovePlan): string {
  return plan.changes.map((change) => fileDiff(change)).join('\n');
}
