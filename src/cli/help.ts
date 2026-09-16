const commands = [
  'search',
  'show',
  'list',
  'related',
  'validate',
  'index',
  'status',
  'move',
];

export function help(command?: string): string {
  if (command !== undefined && !commands.includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const usage = command === undefined ? 'wiki [command]' : `wiki ${command}`;
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
    'This foundation build provides help/version and the search-store library.',
    `Wiki commands are planned: ${commands.join(', ')}.`,
  ].join('\n');
}
