import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The secret Crew signs proxied requests with. Seen in Crew 0.12.2: the
 * gateway passes it to the backend as KIROCREW_PROXY_SECRET and sets
 * KIROCREW_HOME, which may not be ~/.kiro/crew. Reading the default home first
 * picks up another gateway's secret, and every request then fails with 401.
 */
export function readSecret(env: NodeJS.ProcessEnv, appName: string, home: string = homedir()): string | null {
  for (const key of ['EXORCIST_CREW_SECRET', 'KIROCREW_PROXY_SECRET']) {
    const v = env[key]?.trim();
    if (v) return v;
  }
  const crewHome = env['KIROCREW_HOME'] || join(home, '.kiro', 'crew');
  const file = join(crewHome, 'apps', appName, '.app_secret');
  if (!existsSync(file)) return null;
  const s = readFileSync(file, 'utf8').trim();
  return s.length > 0 ? s : null;
}
