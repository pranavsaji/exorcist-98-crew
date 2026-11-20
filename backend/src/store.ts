import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FindingSchema } from '../../shared/report.js';

export const MAX_FOLDERS = 20;
/** Findings kept per folder for the page. Counts are always complete. */
export const MAX_STORED_FINDINGS = 500;
/** Short hashes of every finding, so findings past the stored 500 are not "new" on every patrol (C-010). */
export const MAX_SEEN_KEYS = 50_000;

const FolderResultSchema = z.object({
  ranAt: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
  filesScanned: z.number().int().nonnegative(),
  findingsTotal: z.number().int().nonnegative(),
  findings: z.array(FindingSchema),
  newCount: z.number().int().nonnegative(),
  seen: z.array(z.string()).optional(),
});
export type FolderResult = z.infer<typeof FolderResultSchema>;

const StateSchema = z.object({
  version: z.literal(1),
  folders: z.array(z.string()),
  lastPatrolAt: z.string().nullable(),
  results: z.record(FolderResultSchema),
});
export type State = z.infer<typeof StateSchema>;

export const emptyState = (): State => ({ version: 1, folders: [], lastPatrolAt: null, results: {} });

export type Store = { read(): State; write(s: State): void };

/** State in one JSON file, written atomically (temp file then rename). */
export function fileStore(dataDir: string): Store {
  const file = join(dataDir, 'state.json');
  return {
    read() {
      let raw: string;
      try {
        raw = readFileSync(file, 'utf8');
      } catch {
        return emptyState();
      }
      try {
        const parsed = StateSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : emptyState();
      } catch {
        return emptyState();
      }
    },
    write(s) {
      mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
      renameSync(tmp, file);
    },
  };
}

export function memoryStore(initial: State = emptyState()): Store {
  let s = structuredClone(initial);
  return { read: () => structuredClone(s), write: (n) => { s = structuredClone(n); } };
}
