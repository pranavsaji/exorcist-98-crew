import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { parseReport } from '../../shared/report.js';
import type { Finding, Result } from '../../shared/report.js';

export const SCAN_TIMEOUT_MS = 120_000;
export const SCAN_MAX_OUTPUT = 20 * 1024 * 1024;
export const DEFAULT_PACKAGE = '@exorcist-98/cli@0.1.0';

/** How to start the scanner: a program and the arguments that come before `scan`. */
export type ScannerCommand = { file: string; args: string[] };

export type ScanOutcome = Result<{ filesScanned: number; findings: Finding[] }>;
export type Scanner = (folder: string) => Promise<ScanOutcome>;

const ConfigSchema = z.object({ cliPath: z.string().min(1).optional() }).passthrough();

/**
 * The scanner command comes from `EXORCIST_CLI`, then `cliPath` in the config
 * file, then the published npm package. It is never taken from a request.
 */
export function resolveScannerCommand(env: NodeJS.ProcessEnv, configFiles: string | readonly string[]): ScannerCommand {
  let cliPath = env['EXORCIST_CLI'];
  // The first config file that names a cliPath wins.
  for (const configFile of typeof configFiles === 'string' ? [configFiles] : configFiles) {
    if (cliPath || !existsSync(configFile)) continue;
    try {
      const parsed = ConfigSchema.safeParse(JSON.parse(readFileSync(configFile, 'utf8')));
      if (parsed.success) cliPath = parsed.data.cliPath;
    } catch {
      // A broken config file is skipped.
    }
  }
  if (cliPath) return { file: process.execPath, args: [cliPath] };
  return { file: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['-y', DEFAULT_PACKAGE] };
}

export const defaultConfigFile = (env: NodeJS.ProcessEnv): string =>
  join(env['EXORCIST_CREW_DATA'] ?? join(homedir(), '.exorcist-98-crew'), 'config.json');

/** Runs `<command> scan <folder> --format json --fail-on none`, with no shell. */
export function cliScanner(cmd: ScannerCommand, timeoutMs = SCAN_TIMEOUT_MS): Scanner {
  return (folder) =>
    new Promise((resolvePromise) => {
      execFile(
        cmd.file,
        [...cmd.args, 'scan', folder, '--format', 'json', '--fail-on', 'none'],
        { timeout: timeoutMs, maxBuffer: SCAN_MAX_OUTPUT, windowsHide: true, encoding: 'utf8' },
        (err, stdout, stderr) => {
          if (err) {
            const reason = err.killed
              ? `The scan took longer than ${Math.round(timeoutMs / 1000)} seconds and was stopped.`
              : firstLine(stderr) || `The scanner failed (${err.code ?? 'error'}).`;
            resolvePromise({ ok: false, error: reason });
            return;
          }
          resolvePromise(parseReport(stdout));
        },
      );
    });
}

function firstLine(s: string): string {
  return s.split('\n').map((l) => l.trim()).find((l) => l.length > 0)?.slice(0, 300) ?? '';
}
