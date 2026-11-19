import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSecret } from '../backend/src/secret.js';

const APP = 'exorcist-98-crew';
function homeWith(secret: string | null): string {
  const home = mkdtempSync(join(tmpdir(), 'x98-secret-'));
  if (secret !== null) {
    mkdirSync(join(home, 'apps', APP), { recursive: true });
    writeFileSync(join(home, 'apps', APP, '.app_secret'), `${secret}\n`);
  }
  return home;
}

describe('backend secret (seen in Crew 0.12.2)', () => {
  it('prefers the secret Crew passes in KIROCREW_PROXY_SECRET', () => {
    const crewHome = homeWith('EXAMPLE_TOKEN_DO_NOT_USE_FILE');
    expect(readSecret({ KIROCREW_PROXY_SECRET: 'EXAMPLE_TOKEN_DO_NOT_USE_ENV', KIROCREW_HOME: crewHome }, APP)).toBe('EXAMPLE_TOKEN_DO_NOT_USE_ENV');
  });

  it("reads the app secret from Crew's own home, not ~/.kiro/crew", () => {
    const crewHome = homeWith('EXAMPLE_TOKEN_DO_NOT_USE_THIS_HOME');
    const userHome = mkdtempSync(join(tmpdir(), 'x98-user-'));
    mkdirSync(join(userHome, '.kiro', 'crew', 'apps', APP), { recursive: true });
    writeFileSync(join(userHome, '.kiro', 'crew', 'apps', APP, '.app_secret'), 'EXAMPLE_TOKEN_DO_NOT_USE_OTHER_GATEWAY');
    expect(readSecret({ KIROCREW_HOME: crewHome }, APP, userHome)).toBe('EXAMPLE_TOKEN_DO_NOT_USE_THIS_HOME');
    expect(readSecret({}, APP, userHome)).toBe('EXAMPLE_TOKEN_DO_NOT_USE_OTHER_GATEWAY');
  });

  it('an explicit EXORCIST_CREW_SECRET wins, and no secret anywhere is null', () => {
    expect(readSecret({ EXORCIST_CREW_SECRET: 'EXAMPLE_TOKEN_DO_NOT_USE', KIROCREW_PROXY_SECRET: 'x' }, APP)).toBe('EXAMPLE_TOKEN_DO_NOT_USE');
    expect(readSecret({ KIROCREW_HOME: homeWith(null) }, APP, homeWith(null))).toBeNull();
  });
});
