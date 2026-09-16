const commands = new Set([
  'search',
  'show',
  'list',
  'related',
  'validate',
  'index',
  'status',
  'move',
]);

const descriptions: Readonly<Record<string, readonly string[]>> = {
  show: [
    'show <path[#heading] | alias>',
    'Read current content with heading context and referenced footnotes.',
  ],
  list: [
    'list [filters] [--limit <number>]',
    'List current documents; apply all filters before limiting.',
    '  --type <value>      Exact complete type',
    '  --category <value>  Exact first type segment',
    '  --name <value>      Exact second type segment',
    '  --about <path>      Exact root-relative subject path',
    '  --path <glob>       Match document paths',
    '  --stale             Review queue: due today or earlier',
    '  --limit <number>    Positive document limit (default: unlimited)',
  ],
};

export function help(command?: string): string {
  if (command !== undefined && !commands.has(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const details = command === undefined ? undefined : descriptions[command];
  const usage =
    command === undefined
      ? 'wiki [command]'
      : `wiki ${details?.[0] ?? command}`;
  return [
    'Agent Wiki — local Markdown wiki',
    '',
    `Usage: ${usage} [options]`,
    '',
    'Options (before or after the command):',
    '  --root <directory>  Override root discovery',
    '  --json              Emit structured results and diagnostics',
    '  -h, --help          Show help',
    '  -v, --version       Show version',
    '',
    ...(details?.slice(1) ?? [
      'Available commands: show, list.',
      'Planned commands: search, related, validate, index, status, move.',
    ]),
  ].join('\n');
}
