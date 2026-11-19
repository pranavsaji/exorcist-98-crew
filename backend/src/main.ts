import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME, createServer } from './server.js';
import { cliScanner, resolveScannerCommand } from './scanner.js';
import { fileStore } from './store.js';
import { readSecret } from './secret.js';


const env = process.env;
// Crew 0.12.2 creates a private data/ folder in each app's directory and sets
// KIROCREW_HOME; use it so two gateways never share one folder list.
const crewData = env['KIROCREW_HOME'] ? join(env['KIROCREW_HOME'], 'apps', APP_NAME, 'data') : null;
const dataDir = env['EXORCIST_CREW_DATA'] ?? (crewData && existsSync(crewData) ? crewData : join(homedir(), '.exorcist-98-crew'));
const port = Number(env['PORT'] ?? 4598);
const secret = readSecret(env, APP_NAME);
// Crew's app data folder first, then the user-level file (both documented in the README).
const command = resolveScannerCommand(env, [join(dataDir, 'config.json'), join(homedir(), '.exorcist-98-crew', 'config.json')]);

const server = createServer({ store: fileStore(dataDir), scanner: cliScanner(command), secret });
server.listen(port, '127.0.0.1', () => {
  // Ids and settings only; never file contents.
  process.stderr.write(
    `exorcist-98-crew backend on 127.0.0.1:${port}; signed requests ${secret ? 'required' : 'not required (no app secret found)'}; data in ${dataDir}\n`,
  );
});
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
