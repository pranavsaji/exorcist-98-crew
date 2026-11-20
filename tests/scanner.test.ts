import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cliScanner, missingScanner, NO_SCANNER_ERROR, resolveScannerCommand } from '../backend/src/scanner.js';
import { report } from './arb.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'x98-scan-'));

function fakeCli(body: string): string {
  const file = join(tmp(), 'fake-cli.mjs');
  writeFileSync(file, body);
  return file;
}

describe('scanner command', () => {
  it('uses EXORCIST_CLI, then the config file, and never falls back to an unpublished npm package', () => {
    const dir = tmp();
    const cfg = join(dir, 'config.json');
    expect(resolveScannerCommand({}, cfg)).toBeNull();
    writeFileSync(cfg, JSON.stringify({ cliPath: '/opt/exorcist/index.mjs' }));
    expect(resolveScannerCommand({}, cfg)).toEqual({ file: process.execPath, args: ['/opt/exorcist/index.mjs'] });
    expect(resolveScannerCommand({ EXORCIST_CLI: '/env/cli.mjs' }, cfg)?.args).toEqual(['/env/cli.mjs']);
    writeFileSync(cfg, '{broken');
    expect(resolveScannerCommand({}, cfg)).toBeNull();
  });
  it('with no scanner set up, every folder is an error, never clean', async () => {
    expect(await missingScanner('/any')).toEqual({ ok: false, error: NO_SCANNER_ERROR });
  });
});

describe('scanner config in two places (Crew app data folder, then ~/.exorcist-98-crew)', () => {
  it('uses the first file that names a cliPath, skipping missing and broken ones', () => {
    const a = join(tmp(), 'config.json');
    const b = join(tmp(), 'config.json');
    writeFileSync(b, JSON.stringify({ cliPath: '/user/cli.mjs' }));
    expect(resolveScannerCommand({}, [a, b])?.args).toEqual(['/user/cli.mjs']);
    writeFileSync(a, '{broken');
    expect(resolveScannerCommand({}, [a, b])?.args).toEqual(['/user/cli.mjs']);
    writeFileSync(a, JSON.stringify({ cliPath: '/crew/cli.mjs' }));
    expect(resolveScannerCommand({}, [a, b])?.args).toEqual(['/crew/cli.mjs']);
  });
});

describe('REQ-02.2-3 running the scanner', () => {
  it('passes a fixed argument list and parses the JSON report', async () => {
    const out = report([{ ruleId: 'EX-001', title: 't', severity: 'critical', file: 'a.md', line: 1, col: 2, span: 's', fix: 'f' }], 5);
    const cli = fakeCli(`
      const args = process.argv.slice(2);
      if (JSON.stringify(args.slice(0,1).concat(args.slice(2))) !== JSON.stringify(['scan','--format','json','--fail-on','none'])) { console.error('bad args ' + JSON.stringify(args)); process.exit(2); }
      process.stdout.write(${JSON.stringify(out)});
    `);
    const r = await cliScanner({ file: process.execPath, args: [cli] })('/some folder; rm -rf ~');
    expect(r).toEqual({ ok: true, value: { filesScanned: 5, findings: [expect.objectContaining({ ruleId: 'EX-001' })] } });
  });

  it('reports a scanner failure with its first stderr line', async () => {
    const cli = fakeCli(`console.error('\\nCould not find the virus definitions.'); process.exit(2);`);
    expect(await cliScanner({ file: process.execPath, args: [cli] })('/x')).toEqual({ ok: false, error: 'Could not find the virus definitions.' });
  });

  it('treats junk output as an error, not as clean', async () => {
    const cli = fakeCli(`console.log('No threats found in 3 files.');`);
    expect((await cliScanner({ file: process.execPath, args: [cli] })('/x')).ok).toBe(false);
  });

  it('stops a scan that runs too long', async () => {
    const cli = fakeCli(`setTimeout(() => {}, 60000);`);
    const r = await cliScanner({ file: process.execPath, args: [cli] }, 300)('/x');
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/longer than/) });
  });
});

// The real Exorcist 98 CLI, from a sibling checkout of pranavsaji/exorcist-98.
const MAIN = resolve(import.meta.dirname, '../../exorcist-98');
const REAL_CLI = process.env['EXORCIST_CLI'] ?? join(MAIN, 'packages/cli/dist/index.mjs');
const HAUNTED = join(MAIN, 'fixtures/haunted-repo');

describe.skipIf(!existsSync(REAL_CLI) || !existsSync(HAUNTED))('the real Exorcist 98 CLI', () => {
  it('scans the Haunted Repo and every finding parses', async () => {
    const r = await cliScanner({ file: process.execPath, args: [REAL_CLI] })(HAUNTED);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.filesScanned).toBeGreaterThan(10);
    expect(r.value.findings.length).toBeGreaterThan(20);
    expect(new Set(r.value.findings.map((f) => f.severity))).toContain('critical');
  });
});
