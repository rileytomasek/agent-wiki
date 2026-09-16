import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

import { indexWiki } from '../../src/index.ts';

async function pauseEmbedding(): Promise<never> {
  if (process.send === undefined)
    throw new Error('Expected an owned test child');
  process.send('text-ready');
  await delay(60_000);
  throw new Error('Index child was not interrupted');
}

function textReady(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Index child did not reach embedding'));
    }, 10_000);
    child.once('message', (message: unknown) => {
      clearTimeout(timeout);
      if (message === 'text-ready') resolve();
      else reject(new Error('Unexpected index child message'));
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', () => {
      clearTimeout(timeout);
      reject(new Error('Index child exited before reaching embedding'));
    });
  });
}

interface InterruptedChild {
  readonly pid: number;
  readonly signal: NodeJS.Signals | null;
}

/** Terminate only this fixture's child, after its text checkpoint is durable. */
export async function interruptAfterText(
  root: string
): Promise<InterruptedChild> {
  const child = fork(import.meta.filename, ['--pause-index', root], {
    silent: true,
    execArgv: [],
  });
  const closed = new Promise<void>((resolve) => {
    child.once('close', () => {
      resolve();
    });
  });
  try {
    await textReady(child);
    const pid = child.pid;
    if (pid === undefined)
      throw new Error('Index child has no process identity');
    if (!child.kill('SIGTERM'))
      throw new Error('Could not stop owned index child');
    await closed;
    return { pid, signal: child.signalCode };
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
    await closed;
  }
}

if (process.argv[2] === '--pause-index') {
  const root = process.argv[3];
  if (root === undefined) throw new Error('Index child requires a wiki root');
  await indexWiki(root, { embed: pauseEmbedding });
}
