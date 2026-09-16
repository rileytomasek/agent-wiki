import { mkdtemp, rm } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  indexStatus,
  indexWiki,
  listDocuments,
  refreshWorkspace,
  related,
  validate,
} from '../src/index.ts';
import {
  benchmarkDocuments,
  writeBenchmarkCorpus,
} from './benchmark-corpus.ts';

async function measure(name: string, run: () => Promise<unknown>) {
  const start = performance.now();
  await run();
  return { name, milliseconds: Math.round(performance.now() - start) };
}

async function benchmark(root: string) {
  const options = {
    embed: () =>
      Promise.resolve({ docsProcessed: 0, chunksEmbedded: 0, errors: 0 }),
  };
  return [
    await measure('parse cold', () => refreshWorkspace(root)),
    await measure('parse warm', () => refreshWorkspace(root)),
    await measure('list warm', () => listDocuments(root)),
    await measure('validate warm', () => validate(root)),
    await measure('related warm', () => related(root, 'group-0/note-0.md')),
    await measure('index text cold', () => indexWiki(root, options)),
    await measure('index text unchanged', () => indexWiki(root, options)),
    await measure('status warm', () => indexStatus(root)),
  ];
}

const root = await mkdtemp(join(tmpdir(), 'agent-wiki-benchmark-'));
try {
  const sourceBytes = await writeBenchmarkCorpus(root);
  const observations = await benchmark(root);
  console.log(
    JSON.stringify(
      {
        environment: {
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
          cpu: cpus()[0]?.model,
        },
        corpus: {
          documents: benchmarkDocuments,
          sourceBytes,
          malformedDocuments: 40,
        },
        method:
          'One sample per operation. Cold means no derived cache, not cold OS disk cache.',
        modelCosts:
          'Excluded: no inference or model downloads. Text indexes retain pending embeddings.',
        observations,
      },
      null,
      2
    )
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
