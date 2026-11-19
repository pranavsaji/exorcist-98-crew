import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { verifyProxy } from '../../shared/hmac.js';
import { countBySeverity, forAgent, newFindings, sortFindings, worstLevel } from '../../shared/report.js';
import type { AgentFinding, Level, Severity } from '../../shared/report.js';
import { MAX_FOLDERS, MAX_STORED_FINDINGS } from './store.js';
import type { FolderResult, Store } from './store.js';
import type { Scanner } from './scanner.js';

export const APP_NAME = 'exorcist-98-crew';
const PREFIXES = [`/apps/${APP_NAME}/api`, '/api'];
const MAX_BODY = 16 * 1024;

export type Deps = {
  store: Store;
  scanner: Scanner;
  /** The gateway's app secret. When set, every request must be signed. */
  secret: string | null;
  now?: () => Date;
  /** Called after each patrol that finished (HTTP or scheduled). Must not throw. */
  onPatrol?: (summary: PatrolSummary) => Promise<void>;
};

/** The agent-facing patrol report: counts and locations, never quoted text. */
export type PatrolSummary = {
  ranAt: string;
  folders: {
    path: string;
    ok: boolean;
    error?: string;
    level: Level;
    counts: Record<Severity, number>;
    newSerious: AgentFinding[];
  }[];
  newSeriousTotal: number;
};

const AddFolderSchema = z.object({ path: z.string().min(1).max(4096) }).strict();

/** Strip the optional proxy prefix so routes work whether or not the gateway removes it. */
export function routeOf(pathname: string): string {
  for (const p of PREFIXES) {
    if (pathname === p) return '/';
    if (pathname.startsWith(`${p}/`)) return pathname.slice(p.length);
  }
  return pathname;
}

export function checkFolder(raw: string): { ok: true; path: string } | { ok: false; error: string } {
  if (!isAbsolute(raw)) return { ok: false, error: 'Give the full path of a folder, starting from the root (for example /home/me/project).' };
  const path = resolve(raw);
  if (path === resolve('/')) return { ok: false, error: 'Scanning the whole disk is not allowed. Pick a project folder.' };
  try {
    if (!statSync(path).isDirectory()) return { ok: false, error: 'That path is a file, not a folder.' };
  } catch {
    return { ok: false, error: 'That folder does not exist.' };
  }
  return { ok: true, path };
}

export type App = {
  handler: (req: IncomingMessage, res: ServerResponse) => void;
  /** Runs one patrol, or returns null if one is already running. */
  runPatrol: () => Promise<PatrolSummary | null>;
};

export function createHandler(deps: Deps): (req: IncomingMessage, res: ServerResponse) => void {
  return createApp(deps).handler;
}

export function createApp(deps: Deps): App {
  const now = deps.now ?? (() => new Date());
  let patrolRunning = false;

  async function runPatrol(): Promise<PatrolSummary | null> {
    if (patrolRunning) return null;
    patrolRunning = true;
    try {
      const summary = await patrol();
      if (deps.onPatrol) await deps.onPatrol(summary).catch(() => undefined);
      return summary;
    } finally {
      patrolRunning = false;
    }
  }

  async function patrol(): Promise<PatrolSummary> {
    const ranAt = now().toISOString();
    const state = deps.store.read();
    const summary: PatrolSummary = { ranAt, folders: [], newSeriousTotal: 0 };
    for (const path of state.folders) {
      const outcome = await deps.scanner(path);
      const prev = state.results[path];
      if (!outcome.ok) {
        // Keep the last good findings on screen, but mark this run as failed.
        state.results[path] = {
          ranAt, ok: false, error: outcome.error,
          filesScanned: 0, findingsTotal: prev?.findingsTotal ?? 0,
          findings: prev?.findings ?? [], newCount: 0,
        };
        summary.folders.push({ path, ok: false, error: outcome.error, level: 'clean', counts: countBySeverity([]), newSerious: [] });
        continue;
      }
      const findings = outcome.value.findings;
      // A folder's first patrol has no baseline, so everything counts as new.
      const fresh = newFindings(prev?.findings ?? [], findings);
      const newSerious = sortFindings(fresh.filter((f) => f.severity === 'critical' || f.severity === 'high')).map(forAgent);
      const result: FolderResult = {
        ranAt, ok: true, filesScanned: outcome.value.filesScanned, findingsTotal: findings.length,
        findings: sortFindings(findings).slice(0, MAX_STORED_FINDINGS), newCount: fresh.length,
      };
      state.results[path] = result;
      summary.folders.push({ path, ok: true, level: worstLevel(findings), counts: countBySeverity(findings), newSerious });
      summary.newSeriousTotal += newSerious.length;
    }
    state.lastPatrolAt = ranAt;
    // Re-read so folders added or removed during the patrol are kept.
    const latest = deps.store.read();
    for (const path of Object.keys(state.results)) {
      if (latest.folders.includes(path)) latest.results[path] = state.results[path] as FolderResult;
    }
    latest.lastPatrolAt = ranAt;
    deps.store.write(latest);
    return summary;
  }

  function status() {
    const s = deps.store.read();
    return {
      lastPatrolAt: s.lastPatrolAt,
      patrolRunning,
      folders: s.folders.map((path) => {
        const r = s.results[path];
        return {
          path,
          result: r
            ? { ...r, level: worstLevel(r.findings), counts: countBySeverity(r.findings) }
            : null,
        };
      }),
    };
  }

  async function handle(req: IncomingMessage, res: ServerResponse, body: string): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = routeOf(url.pathname);
    const method = req.method ?? 'GET';
    // Crew's health probe is unsigned, so /health is open. It reveals nothing.
    if (route === '/health' && method === 'GET') return send(res, 200, { ok: true });
    if (deps.secret !== null) {
      // Crew 0.12.2 sends X-KiroCrew-Proxy (the docs say X-Crew-Proxy); accept both.
      const header = req.headers['x-kirocrew-proxy'] ?? req.headers['x-crew-proxy'];
      const ok = verifyProxy({
        secret: deps.secret, header: Array.isArray(header) ? header[0] : header,
        method: req.method ?? 'GET', pathAndQuery: `${url.pathname}${url.search}`, body,
        nowSeconds: now().getTime() / 1000,
      });
      if (!ok) return send(res, 401, { error: 'This request was not signed by the Crew gateway.' });
    }
    if (route === '/status' && method === 'GET') return send(res, 200, status());

    if (route === '/folders' && method === 'POST') {
      let json: unknown;
      try { json = JSON.parse(body); } catch { return send(res, 400, { error: 'Send JSON: {"path": "/full/path"}.' }); }
      const parsed = AddFolderSchema.safeParse(json);
      if (!parsed.success) return send(res, 400, { error: 'Send JSON: {"path": "/full/path"}.' });
      const checked = checkFolder(parsed.data.path);
      if (!checked.ok) return send(res, 400, { error: checked.error });
      const s = deps.store.read();
      if (s.folders.includes(checked.path)) return send(res, 200, { path: checked.path, added: false });
      if (s.folders.length >= MAX_FOLDERS) return send(res, 400, { error: `You can watch up to ${MAX_FOLDERS} folders.` });
      s.folders.push(checked.path);
      deps.store.write(s);
      return send(res, 201, { path: checked.path, added: true });
    }

    if (route === '/folders' && method === 'DELETE') {
      const path = url.searchParams.get('path') ?? '';
      const s = deps.store.read();
      if (!s.folders.includes(path)) return send(res, 404, { error: 'That folder is not being watched.' });
      s.folders = s.folders.filter((f) => f !== path);
      delete s.results[path];
      deps.store.write(s);
      res.writeHead(204).end();
      return;
    }

    if (route === '/patrol' && method === 'POST') {
      const summary = await runPatrol();
      if (summary === null) return send(res, 409, { error: 'A patrol is already running.' });
      return send(res, 200, summary);
    }

    return send(res, 404, { error: 'Not found.' });
  }

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) { send(res, 413, { error: 'Request too large.' }); return; }
      handle(req, res, Buffer.concat(chunks).toString('utf8')).catch(() => {
        if (!res.headersSent) send(res, 500, { error: 'Internal error.' });
      });
    });
  };
  return { handler, runPatrol };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

export function createServer(deps: Deps): Server {
  return createHttpServer(createHandler(deps));
}
