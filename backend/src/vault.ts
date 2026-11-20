import { execFile } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { z } from 'zod';
import type { Result } from '../../shared/report.js';
import type { ScannerCommand } from './scanner.js';

/**
 * Quarantine through the Exorcist 98 Quarantine Vault (main repo,
 * `packages/shield/src/vault.ts`, run as `exorcist vault ...`). The vault keeps
 * an exact copy with its sha256, refuses to quarantine the same file twice, and
 * refuses to restore over a file that changed since. This module only decides
 * what may be moved and asks the CLI to move it; it never deletes anything.
 *
 * The vault lives in `<folder>/.exorcist/vault`, the CLI's default when run in
 * that folder, so `exorcist vault list --dir <folder>/.exorcist` shows the same.
 */

export const STATE_DIR = '.exorcist';
export const VAULT_SUBDIR = `${STATE_DIR}/vault`;
const VAULT_TIMEOUT_MS = 30_000;
const MAX_ENTRIES = 200;
/** The id format the vault writes: `<14-digit stamp>-<slug>-<4 hex>`. */
export const VAULT_ID = /^\d{14}-[a-z0-9-]{1,30}-[0-9a-f]{4}$/;

const EntrySchema = z.object({
  id: z.string().regex(VAULT_ID),
  kind: z.enum(['mcp-server', 'file']),
  target: z.string(),
  reason: z.string(),
  createdAt: z.string(),
  sha256: z.string(),
  status: z.enum(['quarantined', 'restored']),
}).passthrough();

/** One vault entry for the page: the file relative to its watched folder. */
export type VaultItem = { id: string; file: string; reason: string; createdAt: string; status: 'quarantined' | 'restored' };

function inside(root: string, path: string): string | null {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel) ? rel : null;
}

/** File entries of a folder's vault whose target is inside that folder. Read-only. */
export function listVault(folder: string): VaultItem[] {
  let root: string;
  try { root = realpathSync(folder); } catch { return []; }
  const dir = join(root, VAULT_SUBDIR);
  let names: string[];
  try {
    if (!lstatSync(dir).isDirectory()) return [];
    names = readdirSync(dir).filter((n) => VAULT_ID.test(n)).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
  const out: VaultItem[] = [];
  for (const name of names) {
    const file = join(dir, name, 'manifest.json');
    try {
      if (!lstatSync(file).isFile()) continue;
      const e = EntrySchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
      if (!e.success || e.data.kind !== 'file' || e.data.id !== name) continue;
      const rel = inside(root, e.data.target);
      if (rel === null) continue;
      out.push({ id: e.data.id, file: rel.split(sep).join('/'), reason: e.data.reason.slice(0, 200), createdAt: e.data.createdAt, status: e.data.status });
    } catch {
      // An unreadable manifest is skipped, as the CLI does.
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The absolute path of a file that may be quarantined, or why not. `reported`
 * is the set of files the last patrol named for this folder: only those can be
 * moved, so a request cannot point at any other file.
 */
export function checkQuarantineTarget(folder: string, file: string, reported: ReadonlySet<string>): Result<string> {
  const no = (error: string) => ({ ok: false as const, error });
  if (!reported.has(file)) return no('Only a file named in the last patrol of this folder can be moved to the vault.');
  if (file === '' || isAbsolute(file) || file.split(/[\\/]/).some((s) => s === '..' || s === '')) return no('That is not a path inside the folder.');
  if (file === STATE_DIR || file.startsWith(`${STATE_DIR}/`)) return no('Files in .exorcist belong to the Exorcist 98 Shield and vault, and are not moved.');
  let root: string;
  try { root = realpathSync(folder); } catch { return no('The folder no longer exists.'); }
  const abs = join(root, file);
  let st;
  try { st = lstatSync(abs); } catch { return no('The file is no longer there. Run a patrol to update the list.'); }
  if (st.isSymbolicLink()) return no('The file is a symbolic link. It was not moved; remove the link by hand if you want it gone.');
  if (!st.isFile()) return no('Only regular files can be moved to the vault.');
  // Every folder on the way must resolve inside the watched folder too.
  let real: string;
  try { real = realpathSync(abs); } catch { return no('The file could not be resolved.'); }
  if (inside(root, real) === null) return no('The file resolves outside the watched folder, so it was not moved.');
  return { ok: true, value: real };
}

export type VaultOps = {
  quarantine(folder: string, absFile: string, reason: string): Promise<Result<string>>;
  restore(folder: string, id: string): Promise<Result<null>>;
};

/** Runs `exorcist vault ...` with the configured CLI, no shell, fixed arguments. */
export function cliVault(cmd: ScannerCommand, timeoutMs = VAULT_TIMEOUT_MS): VaultOps {
  const run = (args: string[]) =>
    new Promise<Result<string>>((resolve) => {
      execFile(cmd.file, [...cmd.args, 'vault', ...args], { timeout: timeoutMs, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
        if (err) {
          const why = err.killed ? 'The vault took too long and was stopped.' : (stderr.split('\n').map((l) => l.trim()).find(Boolean) ?? 'The vault command failed.');
          resolve({ ok: false, error: why.slice(0, 300) });
          return;
        }
        resolve({ ok: true, value: stdout });
      });
    });
  return {
    async quarantine(folder, absFile, reason) {
      const r = await run(['quarantine-file', absFile, '--dir', join(realpathSync(folder), STATE_DIR), '--reason', reason]);
      if (!r.ok) return r;
      const id = /Vault entry: (\S+)/.exec(r.value)?.[1];
      return id && VAULT_ID.test(id) ? { ok: true, value: id } : { ok: false, error: 'The vault did not report an entry id.' };
    },
    async restore(folder, id) {
      if (!VAULT_ID.test(id)) return { ok: false, error: 'That is not a vault entry id.' };
      const r = await run(['restore', id, '--dir', join(realpathSync(folder), STATE_DIR)]);
      return r.ok ? { ok: true, value: null } : r;
    },
  };
}
