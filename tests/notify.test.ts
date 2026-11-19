import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CHANNEL, gatewayNotifier, noticeFor, tokenCookieName } from '../backend/src/notify.js';
import { msUntilNextRun, patrolHour, scheduleNightly } from '../backend/src/schedule.js';
import { createApp } from '../backend/src/server.js';
import type { PatrolSummary } from '../backend/src/server.js';
import { memoryStore } from '../backend/src/store.js';
import { forAgent } from '../shared/report.js';
import { finding } from './arb.js';

const APP = 'exorcist-98-crew';
const summary = (over: Partial<PatrolSummary> = {}): PatrolSummary => ({ ranAt: '2026-11-19T10:00:00.000Z', folders: [], newSeriousTotal: 0, ...over });
const counts = { critical: 0, high: 0, medium: 0, low: 0 };

describe('patrol notification', () => {
  it('nothing new and nothing failed: no notification', () => {
    expect(noticeFor(summary({ folders: [{ path: '/p', ok: true, level: 'low', counts, newSerious: [] }] }), APP)).toBeNull();
  });

  it('new serious problems: a notification with paths and counts, critical when any is critical', () => {
    const n = noticeFor(summary({
      newSeriousTotal: 2,
      folders: [{ path: '/proj', ok: true, level: 'critical', counts, newSerious: [
        { ruleId: 'EX-001', title: 'Hidden Unicode instructions', severity: 'critical', file: 'AGENTS.md', line: 3 },
        { ruleId: 'EX-002', title: 'Instructions addressed to AI', severity: 'high', file: 'README.md', line: 9 },
      ] }],
    }), APP);
    expect(n).toMatchObject({ channel: CHANNEL, priority: 'critical', url: `/apps/${APP}`, title: 'Exorcist 98: 2 new serious problems found' });
    expect(n?.body).toContain('/proj: 2 new serious problems.');
    expect(n?.body).toContain('CRITICAL Hidden Unicode instructions (EX-001) in AGENTS.md, line 3');
  });

  it('a failed scan is reported even with nothing new', () => {
    const n = noticeFor(summary({ folders: [{ path: '/p', ok: false, error: 'The scanner failed (2).', level: 'clean', counts, newSerious: [] }] }), APP);
    expect(n?.title).toBe('Exorcist 98: 1 folder scan failed');
    expect(n?.priority).toBe('default');
  });

  it('never carries quoted file text, for any findings', () => {
    fc.assert(fc.property(fc.array(finding, { minLength: 1, maxLength: 12 }), (fs) => {
      const marked = fs.map((f) => ({ ...f, span: `QUOTE_${f.span}_QUOTE`, fix: `FIX_${f.fix}` }));
      const n = noticeFor(summary({ newSeriousTotal: marked.length, folders: [{ path: '/p', ok: true, level: 'high', counts, newSerious: marked.map(forAgent) }] }), APP);
      expect(JSON.stringify(n)).not.toMatch(/QUOTE_|FIX_/);
    }));
  });
});

describe('gateway notifier (Crew 0.12.2 token exchange, then push)', () => {
  it('exchanges the app secret for a token and pushes with it', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/token')) return new Response(JSON.stringify({ token: 'EXAMPLE_TOKEN_DO_NOT_USE' }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const send = gatewayNotifier('http://127.0.0.1:5476', APP, 'EXAMPLE_SECRET_DO_NOT_USE', fake);
    expect(await send({ channel: CHANNEL, title: 't', body: 'b', priority: 'default', url: '/apps/x', group_key: 'g' })).toEqual({ ok: true });
    expect(calls[0]?.url).toBe(`http://127.0.0.1:5476/api/apps/${APP}/token`);
    expect((calls[0]?.init?.headers as Record<string, string>)['X-App-Secret']).toBe('EXAMPLE_SECRET_DO_NOT_USE');
    expect(calls[1]?.url).toBe('http://127.0.0.1:5476/api/notifications/push');
    expect((calls[1]?.init?.headers as Record<string, string>)['cookie']).toBe('mc_token_5476=EXAMPLE_TOKEN_DO_NOT_USE');
    expect(calls[1]?.url).not.toContain('token=');
  });

  it('names the cookie after the gateway port', () => {
    expect(tokenCookieName('http://127.0.0.1:5490')).toBe('mc_token_5490');
    expect(tokenCookieName('https://crew.example.invalid')).toBe('mc_token_443');
  });

  it('reports failures instead of throwing', async () => {
    const down = (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch;
    expect((await gatewayNotifier('http://x.invalid', APP, 's', down)({ channel: CHANNEL, title: 't', body: 'b', priority: 'default', url: '/', group_key: 'g' })).ok).toBe(false);
    const denied = (async () => new Response('{}', { status: 403 })) as typeof fetch;
    expect(await gatewayNotifier('http://x.invalid', APP, 's', denied)({ channel: CHANNEL, title: 't', body: 'b', priority: 'default', url: '/', group_key: 'g' })).toEqual({ ok: false, error: 'token exchange returned 403' });
  });
});

describe('nightly schedule', () => {
  it('the next run is always within a day and lands on the hour', () => {
    fc.assert(fc.property(fc.date({ min: new Date('2026-01-01'), max: new Date('2027-12-31') }), fc.integer({ min: 0, max: 23 }), (now, hour) => {
      const ms = msUntilNextRun(now, hour);
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(25 * 3600 * 1000); // 25 h allows a DST change
      const at = new Date(now.getTime() + ms);
      expect([at.getMinutes(), at.getSeconds(), at.getMilliseconds()]).toEqual([0, 0, 0]);
    }));
  });

  it('reads EXORCIST_PATROL_HOUR', () => {
    expect(patrolHour(undefined)).toBe(2);
    expect(patrolHour('5')).toBe(5);
    expect(patrolHour('off')).toBeNull();
    expect(patrolHour('25')).toBe(2);
    expect(patrolHour('two')).toBe(2);
  });

  it('runs, re-arms after each run, and stops', async () => {
    const pending: (() => void)[] = [];
    const timer = { setTimeout: (fn: () => void) => { pending.push(fn); return pending.length; }, clearTimeout: () => { pending.length = 0; } };
    let runs = 0;
    const stop = scheduleNightly(async () => { runs++; }, 2, () => new Date(), timer);
    pending.shift()?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toBe(1);
    expect(pending).toHaveLength(1);
    stop();
    expect(pending).toHaveLength(0);
  });
});

describe('scheduled and HTTP patrols share one guard and one notify hook', () => {
  it('a scheduled patrol notifies, and a second one while running is skipped', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const seen: PatrolSummary[] = [];
    const store = memoryStore({ version: 1, folders: ['/tmp'], lastPatrolAt: null, results: {} });
    const app = createApp({
      store, secret: null,
      scanner: async () => { await gate; return { ok: true, value: { filesScanned: 1, findings: [{ ruleId: 'EX-001', title: 't', severity: 'critical', file: 'a', line: 1, col: 1, span: 's', fix: 'f' }] } }; },
      onPatrol: async (s) => { seen.push(s); },
    });
    const first = app.runPatrol();
    expect(await app.runPatrol()).toBeNull();
    release();
    expect((await first)?.newSeriousTotal).toBe(1);
    expect(seen).toHaveLength(1);
  });

  it('a notify hook that throws does not fail the patrol', async () => {
    const app = createApp({
      store: memoryStore(), secret: null,
      scanner: async () => ({ ok: true, value: { filesScanned: 0, findings: [] } }),
      onPatrol: async () => { throw new Error('gateway down'); },
    });
    expect(await app.runPatrol()).not.toBeNull();
  });
});
