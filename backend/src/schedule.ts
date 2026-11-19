/**
 * The backend's own nightly patrol. The Crew cron asks an agent to call the
 * backend, but in Crew 0.12.2 the agent has no token for the gateway's app
 * proxy (C-007), so the patrol must not depend on it. The backend patrols at
 * a fixed local time itself and pushes a Crew notification.
 */
export const DEFAULT_PATROL_HOUR = 2;

/** Milliseconds from `now` until the next `hour:00` local time (strictly in the future). */
export function msUntilNextRun(now: Date, hour: number = DEFAULT_PATROL_HOUR): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
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

export type Timer = { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(t: unknown): void };

/** Calls `run` every day at `hour`. Returns a stop function. */
export function scheduleNightly(run: () => Promise<unknown>, hour: number, now: () => Date = () => new Date(), timer: Timer = globalThis as unknown as Timer): () => void {
  let handle: unknown = null;
  let stopped = false;
  const arm = (): void => {
    if (stopped) return;
    handle = timer.setTimeout(() => {
      void run().catch(() => undefined).finally(arm);
    }, msUntilNextRun(now(), hour));
  };
  arm();
  return () => {
    stopped = true;
    if (handle !== null) timer.clearTimeout(handle);
  };
}
