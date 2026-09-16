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
  search: [
    'search <query> [filters] [--limit <number>]',
    'Search the existing indexed snapshot with QMD ranking and native snippets.',
    '  --type <value>      Exact complete type',
    '  --category <value>  Exact first type segment',
    '  --name <value>      Exact second type segment',
    '  --about <path>      Exact root-relative subject path',
    '  --stale             Review due today or earlier',
    '  --limit <number>    Positive document limit (default: QMD native)',
    'Snippet positions refer to indexed content. Run wiki index to refresh.',
  ],
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
  index: [
    'index [--rebuild]',
    'Explicitly update the search index and generate missing embeddings.',
    '  --rebuild  Recreate search-derived state from readable source files',
  ],
  status: [
    'status',
    'Inspect index availability, source currency, and recorded coverage without models.',
  ],
  related: [
    'related <path[#heading] | alias | attachment | URL> [--limit <number>]',
    'Inspect immediate incoming and outgoing authored references.',
    '  --limit <number>    Positive relationship limit (default: unlimited)',
  ],
  validate: [
    'validate [files | directories | globs ...]',
    'Validate the whole wiki, or selected files against whole-wiki context.',
    'Quote globs so wiki can expand them relative to its root.',
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
      'Available commands: search, show, list, related, validate, index, status.',
      'Planned commands: move.',
    ]),
  ].join('\n');
}
