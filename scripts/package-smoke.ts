import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import manifest from '../package.json' with { type: 'json' };
import { packWiki } from './package-artifact.ts';
import { prepareConsumer, verifyConsumer } from './package-consumer.ts';

const directory = await mkdtemp(join(tmpdir(), 'agent-wiki-consumer-'));
try {
  let artifact = process.env['AGENT_WIKI_PACKAGE'];
  if (artifact === 'registry') artifact = manifest.version;
  artifact ??= `file:${await packWiki(directory)}`;
  await prepareConsumer(directory, artifact);
  await verifyConsumer(
    directory,
    process.argv.includes('--bun') ? 'bun' : 'npm'
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
