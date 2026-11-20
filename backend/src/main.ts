import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { APP_NAME, createApp } from './server.js';
import { cliScanner, missingScanner, resolveScannerCommand } from './scanner.js';
import { withPinWatch } from './pins.js';
import { fileStore } from './store.js';
import { readSecret } from './secret.js';
import { gatewayNotifier, noticeFor } from './notify.js';
import { formatPatrolTime, parsePatrolTime, scheduleNightly } from './schedule.js';

const env = process.env;
// Crew 0.12.2 creates a private data/ folder in each app's directory and sets
// KIROCREW_HOME; use it so two gateways never share one folder list.
const crewData = env['KIROCREW_HOME'] ? join(env['KIROCREW_HOME'], 'apps', APP_NAME, 'data') : null;
const dataDir = env['EXORCIST_CREW_DATA'] ?? (crewData && existsSync(crewData) ? crewData : join(homedir(), '.exorcist-98-crew'));
const port = Number(env['PORT'] ?? 4598);
const secret = readSecret(env, APP_NAME);
// Crew's app data folder first, then the user-level file (both documented in the README).
const configFiles = [join(dataDir, 'config.json'), join(homedir(), '.exorcist-98-crew', 'config.json')];
const command = resolveScannerCommand(env, configFiles);

/** `patrolTime` from the first config file that has one (a string), else undefined. */
function configPatrolTime(): string | undefined {
  for (const f of configFiles) {
    try {
      const v = (JSON.parse(readFileSync(f, 'utf8')) as { patrolTime?: unknown }).patrolTime;
      if (typeof v === 'string') return v;
    } catch {
      // Missing or broken file: try the next one.
    }
  }
  return undefined;
}

// Crew 0.12.2 passes the gateway's address in KIROCREW_GATEWAY_ORIGIN.
const origin = env['KIROCREW_GATEWAY_ORIGIN'];
const notifier = origin && secret ? gatewayNotifier(origin, APP_NAME, secret) : null;

const app = createApp({
  store: fileStore(dataDir),
  // The Exorcist 98 scan, plus the MCP rug-pull watch on each folder's Shield pin file.
  scanner: withPinWatch(command ? cliScanner(command) : missingScanner),
  secret,
  onPatrol: async (summary) => {
    const notice = noticeFor(summary, APP_NAME);
    if (!notice || !notifier) return;
    const r = await notifier(notice);
    // Outcome only; the notice itself names files, so it is not logged.
    process.stderr.write(`exorcist-98-crew: notification ${r.ok ? 'sent' : `not sent (${r.error ?? 'unknown'})`}\n`);
  },
});

const server = createHttpServer(app.handler);
const at = parsePatrolTime(env['EXORCIST_PATROL_TIME'], env['EXORCIST_PATROL_HOUR'], configPatrolTime());
const stopSchedule = at === null ? () => undefined : scheduleNightly(app.runPatrol, at);

server.listen(port, '127.0.0.1', () => {
  // Ids and settings only; never file contents.
  process.stderr.write(
    `exorcist-98-crew backend on 127.0.0.1:${port}; signed requests ${secret ? 'required' : 'not required (no app secret found)'}; ` +
      `scanner ${command ? 'set' : 'NOT set'}; nightly patrol ${at === null ? 'off' : `at ${formatPatrolTime(at)}`}; notifications ${notifier ? 'on' : 'off'}; data in ${dataDir}\n`,
  );
});
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    stopSchedule();
    server.close(() => process.exit(0));
  });
}
