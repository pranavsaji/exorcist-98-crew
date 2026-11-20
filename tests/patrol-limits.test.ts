import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, findingHash } from '../backend/src/server.js';
import { MAX_STORED_FINDINGS, memoryStore } from '../backend/src/store.js';
import type { Finding } from '../shared/report.js';

const f = (i: number): Finding => ({ ruleId: 'EX-002', title: 't', severity: 'high', file: `f${i}.md`, line: 1, col: 1, span: `s${i}`, fix: '' });
const folder = () => mkdtempSync(join(tmpdir(), 'x98-limits-'));

describe('C-010: findings past the stored 500 are not new every patrol', () => {
  it('a second patrol of an unchanged folder with 700 findings reports nothing new', async () => {
    const d = folder();
    const store = memoryStore();
    store.write({ ...store.read(), folders: [d] });
    const all = Array.from({ length: 700 }, (_, i) => f(i));
    const app = createApp({ store, secret: null, scanner: async () => ({ ok: true, value: { filesScanned: 700, findings: all } }) });
    expect((await app.runPatrol())?.newSeriousTotal).toBe(700);
    const second = await app.runPatrol();
    expect(second?.newSeriousTotal).toBe(0);
    const r = store.read().results[d];
    expect(r?.findings).toHaveLength(MAX_STORED_FINDINGS);
    expect(r?.seen).toHaveLength(700);
    expect(findingHash(f(1))).toMatch(/^[0-9a-f]{16}$/);
  });
  it('a result stored before this change (no seen list) still diffs on its findings', async () => {
    const d = folder();
    const store = memoryStore();
    store.write({ version: 1, folders: [d], lastPatrolAt: 'x', results: { [d]: { ranAt: 'x', ok: true, filesScanned: 1, findingsTotal: 1, findings: [f(1)], newCount: 0 } } });
    const app = createApp({ store, secret: null, scanner: async () => ({ ok: true, value: { filesScanned: 2, findings: [f(1), f(2)] } }) });
    expect((await app.runPatrol())?.newSeriousTotal).toBe(1);
  });
});

describe('C-013: one patrol has an overall time limit', () => {
  it('folders past the budget are reported as not scanned, never clean, and keep their last results', async () => {
    const [a, b] = [folder(), folder()];
    const store = memoryStore();
    store.write({ version: 1, folders: [a, b], lastPatrolAt: null, results: { [b]: { ranAt: 'old', ok: true, filesScanned: 1, findingsTotal: 1, findings: [f(9)], newCount: 0 } } });
    let t = 0;
    const app = createApp({
      store, secret: null, patrolBudgetMs: 1000, now: () => new Date(t),
      scanner: async () => { t += 5000; return { ok: true, value: { filesScanned: 1, findings: [] } }; },
    });
    const s = await app.runPatrol();
    expect(s?.folders.find((x) => x.path === a)?.ok).toBe(true);
    const late = s?.folders.find((x) => x.path === b);
    expect(late).toMatchObject({ ok: false, error: expect.stringMatching(/limit/) });
    expect(store.read().results[b]?.findings).toEqual([f(9)]);
  });
});
