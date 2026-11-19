import { z } from 'zod';
import { FindingSchema, SEVERITIES } from '../../shared/report.js';
import type { Level } from '../../shared/report.js';

export type Shape = 'check' | 'circle' | 'square' | 'triangle' | 'diamond';

/** Text label first, shape second, colour third: never colour alone. */
export const LEVELS: Record<Level, { label: string; shape: Shape; plain: string }> = {
  clean:    { label: 'CLEAN',    shape: 'check',    plain: 'Clean' },
  low:      { label: 'LOW',      shape: 'circle',   plain: 'Minor problems' },
  medium:   { label: 'MEDIUM',   shape: 'square',   plain: 'Problems worth a look' },
  high:     { label: 'HIGH',     shape: 'triangle', plain: 'Serious problems' },
  critical: { label: 'CRITICAL', shape: 'diamond',  plain: 'Possessed: act now' },
};

const LevelSchema = z.enum(['clean', ...SEVERITIES]);
const CountsSchema = z.object({ critical: z.number(), high: z.number(), medium: z.number(), low: z.number() });

/** `GET /status`, validated before anything is shown. */
export const StatusSchema = z.object({
  lastPatrolAt: z.string().nullable(),
  patrolRunning: z.boolean(),
  folders: z.array(
    z.object({
      path: z.string(),
      result: z
        .object({
          ranAt: z.string(),
          ok: z.boolean(),
          error: z.string().optional(),
          filesScanned: z.number(),
          findingsTotal: z.number(),
          findings: z.array(FindingSchema),
          newCount: z.number(),
          level: LevelSchema,
          counts: CountsSchema,
        })
        .nullable(),
    }),
  ),
});
export type Status = z.infer<typeof StatusSchema>;

const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]|\uDB40[\uDC00-\uDDEF]/g;

/** Hidden characters become visible `<U+200B>` markers, so a person can see them. */
export function revealHidden(text: string): string {
  return text.replace(HIDDEN, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return `<U+${cp.toString(16).toUpperCase().padStart(4, '0')}>`;
  });
}

export function countsText(c: z.infer<typeof CountsSchema>): string {
  const parts = (['critical', 'high', 'medium', 'low'] as const)
    .filter((s) => c[s] > 0)
    .map((s) => `${c[s]} ${s}`);
  return parts.length === 0 ? 'no findings' : parts.join(', ');
}

export function formatWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'never';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'unknown';
  const mins = Math.round((now.getTime() - t.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return t.toISOString().slice(0, 10);
}
