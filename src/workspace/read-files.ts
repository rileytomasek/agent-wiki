const READ_CONCURRENCY = 16;

/** A fixed number of readers keeps large wikis within ordinary file limits. */
export async function readFiles<T>(
  paths: readonly string[],
  read: (path: string) => Promise<T>
): Promise<readonly T[]> {
  const pending = paths.entries();
  const results: T[] = [];
  async function worker(): Promise<void> {
    const next = pending.next();
    if (next.done === true) return;
    const [index, path] = next.value;
    results[index] = await read(path);
    await worker();
  }
  const count = Math.min(READ_CONCURRENCY, paths.length);
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}
