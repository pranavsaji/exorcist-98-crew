import type { PatrolSummary } from './server.js';

/**
 * Crew notifications, seen in Crew 0.12.2 (not in the docs):
 * - `POST /api/apps/<name>/token` with `X-App-Secret` returns an app token;
 * - `POST /api/notifications/push` with that token and a JSON body
 *   `{ channel, title, body, priority?, url?, group_key? }` shows a
 *   notification, if `channel` is declared in `app.json` under
 *   `notifications.channels`. Rate limit: 30 per 5 minutes per app.
 */
export const CHANNEL = 'new-threats';

export type Notice = { channel: string; title: string; body: string; priority: 'critical' | 'default' | 'passive'; url: string; group_key: string };

/** What a patrol says to the user: counts and paths only, never quoted file text. */
export function noticeFor(summary: PatrolSummary, appName: string): Notice | null {
  const failed = summary.folders.filter((f) => !f.ok);
  if (summary.newSeriousTotal === 0 && failed.length === 0) return null;
  const lines: string[] = [];
  for (const f of summary.folders) {
    if (!f.ok) { lines.push(`${f.path}: the scan failed (${f.error ?? 'unknown error'}).`); continue; }
    if (f.newSerious.length === 0) continue;
    lines.push(`${f.path}: ${f.newSerious.length} new serious problem${f.newSerious.length === 1 ? '' : 's'}.`);
    for (const x of f.newSerious.slice(0, 5)) lines.push(`  ${x.severity.toUpperCase()} ${x.title} (${x.ruleId}) in ${x.file}, line ${x.line}`);
    if (f.newSerious.length > 5) lines.push(`  and ${f.newSerious.length - 5} more`);
  }
  const n = summary.newSeriousTotal;
  const title = n > 0
    ? `Exorcist 98: ${n} new serious problem${n === 1 ? '' : 's'} found`
    : `Exorcist 98: ${failed.length} folder scan${failed.length === 1 ? '' : 's'} failed`;
  return {
    channel: CHANNEL,
    title,
    body: lines.join('\n').slice(0, 4000),
    priority: summary.folders.some((f) => f.newSerious.some((x) => x.severity === 'critical')) ? 'critical' : 'default',
    url: `/apps/${appName}`,
    group_key: `patrol-${summary.ranAt.slice(0, 10)}`,
  };
}

/** `mc_token_<port>`, with the port of the gateway's address. */
export function tokenCookieName(origin: string): string {
  const u = new URL(origin);
  return `mc_token_${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
}

export type Notifier = (notice: Notice) => Promise<{ ok: boolean; error?: string }>;

/** Sends through the gateway. Never throws: a failed notice must not fail the patrol. */
export function gatewayNotifier(origin: string, appName: string, secret: string, fetchFn: typeof fetch = fetch): Notifier {
  return async (notice) => {
    try {
      const t = await fetchFn(`${origin}/api/apps/${encodeURIComponent(appName)}/token`, { method: 'POST', headers: { 'X-App-Secret': secret } });
      if (!t.ok) return { ok: false, error: `token exchange returned ${t.status}` };
      const token = ((await t.json()) as { token?: unknown }).token;
      if (typeof token !== 'string' || token.length === 0) return { ok: false, error: 'token exchange returned no token' };
      const r = await fetchFn(`${origin}/api/notifications/push`, {
        method: 'POST',
        // Crew 0.12.2 reads tokens only from ?token= or the mc_token_<port> cookie,
        // not from Authorization. The cookie keeps the token out of URLs and logs.
        headers: { cookie: `${tokenCookieName(origin)}=${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(notice),
      });
      if (r.ok) return { ok: true };
      // The gateway answers with a short error code (no secrets), which says why.
      const detail = await r.json().then((j: { code?: unknown; error?: unknown }) => String(j.code ?? j.error ?? '')).catch(() => '');
      return { ok: false, error: `push returned ${r.status}${detail ? ` (${detail.slice(0, 120)})` : ''}` };
    } catch (e) {
      return { ok: false, error: String(e).slice(0, 200) };
    }
  };
}
