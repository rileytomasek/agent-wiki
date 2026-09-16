import { spawnSync } from 'node:child_process';

interface Options {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

/** Git hooks export repository selectors that must not reach disposable fixtures. */
export function subprocessEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !key.startsWith('GIT_'))
  );
}

export function run(
  command: string,
  args: readonly string[],
  options: Options = {}
) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
    env: subprocessEnvironment(options.env),
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} exited ${result.status}:\n${result.stdout}\n${result.stderr}`
    );
  }
  return result.stdout;
}
