import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME, createServer } from './server.js';
import { cliScanner, defaultConfigFile, resolveScannerCommand } from './scanner.js';
import { fileStore } from './store.js';

function readSecret(env: NodeJS.ProcessEnv): string | null {
  const fromEnv = env['EXORCIST_CREW_SECRET'];
  if (fromEnv) return fromEnv;
  const file = join(homedir(), '.kiro', 'crew', 'apps', APP_NAME, '.app_secret');
  if (!existsSync(file)) return null;
  const s = readFileSync(file, 'utf8').trim();
  return s.length > 0 ? s : null;
}

const env = process.env;
const dataDir = env['EXORCIST_CREW_DATA'] ?? join(homedir(), '.exorcist-98-crew');
const port = Number(env['PORT'] ?? 4598);
const secret = readSecret(env);
const command = resolveScannerCommand(env, defaultConfigFile(env));

const server = createServer({ store: fileStore(dataDir), scanner: cliScanner(command), secret });
server.listen(port, '127.0.0.1', () => {
  // Ids and settings only; never file contents.
  process.stderr.write(
    `exorcist-98-crew backend on 127.0.0.1:${port}; signed requests ${secret ? 'required' : 'not required (no app secret found)'}; data in ${dataDir}\n`,
  );
});
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
