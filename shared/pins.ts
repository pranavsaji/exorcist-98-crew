import { z } from 'zod';
import type { Finding } from './report.js';

/**
 * MCP rug-pull watch (docs/PLAN.md section 2.3, KNOWN_LIMITATIONS C-009).
 *
 * The Exorcist 98 Shield pins each MCP tool's hash in `<folder>/.exorcist/pins.json`
 * (`packages/shield/src/state.ts` in the main repo, version 1). When a pinned
 * tool's description or schema changes, the Shield hides the tool and records
 * the change under `servers.<server>.pending.<tool>` until the user approves it.
 * This module turns that file into findings. It never writes the file and never
 * approves anything.
 */

/** Where the Shield keeps its pins, relative to a watched folder. */
export const PIN_FILE = '.exorcist/pins.json';
/** Pin files larger than this are reported, not parsed. */
export const MAX_PIN_FILE_BYTES = 5 * 1024 * 1024;
/** Quoted descriptions are cut to this length for the page. */
const MAX_SPAN = 400;

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const PendingSchema = z
  .object({ hash: Sha256, oldHash: Sha256, oldDescription: z.string(), newDescription: z.string(), seenAt: z.string() })
  .passthrough();
const ServerSchema = z
  .object({ tools: z.record(z.unknown()).default({}), pending: z.record(PendingSchema).default({}) })
  .passthrough();
const PinFileSchema = z.object({ version: z.literal(1), servers: z.record(ServerSchema).default({}) }).passthrough();

export const RUG_PULL_RULE = 'EX-006';
export const PIN_FILE_RULE = 'X98-PIN';

const clip = (s: string): string => (s.length > MAX_SPAN ? `${s.slice(0, MAX_SPAN)}…` : s);

/** 1-based line of the first `"key"` at or after `from` in `text`, or 1. */
function lineOf(text: string, key: string, from = 0): { line: number; index: number } {
  const i = text.indexOf(JSON.stringify(key), from);
  if (i < 0) return { line: 1, index: from };
  let line = 1;
  for (let k = 0; k < i; k++) if (text.charCodeAt(k) === 10) line++;
  return { line, index: i };
}

/** Findings for one pin file's text. `null` text means there is no pin file. */
export function pinFindings(text: string | null): Finding[] {
  if (text === null) return [];
  const unreadable = (why: string): Finding[] => [{
    ruleId: PIN_FILE_RULE,
    title: 'Shield pin file is unreadable',
    severity: 'high',
    file: PIN_FILE,
    line: 1,
    col: 1,
    span: why,
    fix: 'The Exorcist 98 Shield refuses to run with a broken pin file, so its MCP rug-pull protection is off for this folder. Restore the file from a backup, or delete it so the Shield pins every tool again on its next start.',
  }];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return unreadable('The file is not valid JSON.');
  }
  const parsed = PinFileSchema.safeParse(json);
  if (!parsed.success) return unreadable('The file is not in the Shield pin format (version 1).');

  const out: Finding[] = [];
  for (const [server, s] of Object.entries(parsed.data.servers)) {
    const serverAt = lineOf(text, server);
    const pendingAt = lineOf(text, 'pending', serverAt.index);
    for (const [tool, p] of Object.entries(s.pending)) {
      const at = lineOf(text, tool, pendingAt.index);
      out.push({
        ruleId: RUG_PULL_RULE,
        // Fixed text: tool and server names come from the MCP server, and titles
        // reach the agent and Crew notifications.
        title: 'MCP tool changed after it was pinned',
        severity: 'critical',
        file: PIN_FILE,
        line: at.line,
        col: 1,
        // Names and the new description are attacker-controlled: shown on the
        // page as plain text only, never sent to the agent or in a notification.
        span: clip(`${server} / ${tool}: ${p.newDescription}`),
        fix: 'The Shield is hiding this tool until you decide. Compare the old and new description, and approve only if you expected the change, with `exorcist approve tool <server> <tool> --dir <this folder>/.exorcist`. Otherwise remove or downgrade the MCP server.',
      });
    }
  }
  return out;
}
