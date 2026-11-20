/**
 * The backend's own nightly patrol. The Crew cron asks an agent to call the
 * backend, but in Crew 0.12.2 the agent has no token for the gateway's app
 * proxy (C-007), so the patrol must not depend on it. The backend patrols at
 * a fixed local time itself and pushes a Crew notification.
 */
export const DEFAULT_PATROL_HOUR = 2;

/** Local time of day for the patrol. */
export type PatrolTime = { hour: number; minute: number };

/** Milliseconds from `now` until the next `hour:minute` local time (strictly in the future). */
export function msUntilNextRun(now: Date, hour: number = DEFAULT_PATROL_HOUR, minute = 0): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** `EXORCIST_PATROL_HOUR`: 0-23 for a nightly patrol, `off` to disable. Anything else means the default. */
export function patrolHour(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PATROL_HOUR;
  if (raw.trim().toLowerCase() === 'off') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_PATROL_HOUR;
}

/**
 * The patrol time, from the first value that is set: `EXORCIST_PATROL_TIME`
 * or `EXORCIST_PATROL_HOUR`, then `patrolTime` in the app's config.json
 * (Crew does not pass custom environment variables to app backends, so the
 * config file is how a Crew user changes it). `HH:MM`, `H`, or `off`.
 * Anything invalid means the default 02:00.
 */
export function parsePatrolTime(...raws: (string | undefined)[]): PatrolTime | null {
  const raw = raws.find((r) => r !== undefined && r.trim() !== '')?.trim().toLowerCase();
  if (raw === undefined) return { hour: DEFAULT_PATROL_HOUR, minute: 0 };
  if (raw === 'off') return null;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(raw);
  const hour = m ? Number(m[1]) : NaN;
  const minute = m?.[2] !== undefined ? Number(m[2]) : 0;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : { hour: DEFAULT_PATROL_HOUR, minute: 0 };
}

export const formatPatrolTime = (t: PatrolTime): string => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export type Timer = { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(t: unknown): void };

/** Calls `run` every day at `hour` (a number, or an hour and minute). Returns a stop function. */
export function scheduleNightly(run: () => Promise<unknown>, at: number | PatrolTime, now: () => Date = () => new Date(), timer: Timer = globalThis as unknown as Timer): () => void {
  let handle: unknown = null;
  let stopped = false;
  const arm = (): void => {
    if (stopped) return;
    handle = timer.setTimeout(() => {
      void run().catch(() => undefined).finally(arm);
    }, msUntilNextRun(now(), typeof at === 'number' ? at : at.hour, typeof at === 'number' ? 0 : at.minute));
  };
  arm();
  return () => {
    stopped = true;
    if (handle !== null) timer.clearTimeout(handle);
  };
}
