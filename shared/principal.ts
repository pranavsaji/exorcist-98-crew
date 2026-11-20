import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Who sent a proxied request, as signed by the Crew gateway.
 *
 * Read from Crew 0.13.0 (`kiro_crew/apps/proxy_auth.py`, not in the public
 * docs): an app whose manifest sets `backend.signedPrincipal: true` receives
 * `X-KiroCrew-Principal: <base64url claim>.<hex hmac>` on every proxied
 * request. The claim names the kind of caller the gateway authenticated:
 * `owner-session` (a dashboard session cookie of the owner), `app-token`,
 * `agent-tool` (agents, crons, MCP tools) or `none`. The HMAC binds the claim
 * to the method, request-target and body, so it cannot be moved to another
 * request; the request id makes it single-use.
 */

export const PRINCIPAL_KINDS = ['owner-session', 'app-token', 'agent-tool', 'none'] as const;
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];
export type PrincipalClaim = { version: 1; kind: PrincipalKind; ownerId: string; issuedAt: number; requestId: string };

const DOMAIN = 'kirocrew-proxy-principal-v1';
const MAX_SKEW_SECONDS = 60;
const MAX_HEADER_BYTES = 4096;
const MAX_OWNER_ID = 256;
const KEYS = ['issuedAt', 'kind', 'ownerId', 'requestId', 'version'];

const isRequestId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);

function shapeOk(c: Record<string, unknown>): c is PrincipalClaim {
  if (c['version'] !== 1) return false;
  if (typeof c['kind'] !== 'string' || !(PRINCIPAL_KINDS as readonly string[]).includes(c['kind'])) return false;
  if (typeof c['issuedAt'] !== 'number' || !Number.isSafeInteger(c['issuedAt'])) return false;
  const owner = c['ownerId'];
  if (typeof owner !== 'string' || owner.length > MAX_OWNER_ID || /[\u0000-\u001f\u007f]/.test(owner)) return false;
  // Only an owner session names an owner; every other kind carries an empty id.
  if ((c['kind'] === 'owner-session') !== (owner.length > 0)) return false;
  return isRequestId(c['requestId']);
}

/** The claim JSON exactly as the gateway encodes it: sorted keys, no spaces. */
function encodeClaim(c: PrincipalClaim): string {
  const json = `{"issuedAt":${c.issuedAt},"kind":${JSON.stringify(c.kind)},"ownerId":${JSON.stringify(c.ownerId)},"requestId":${JSON.stringify(c.requestId)},"version":1}`;
  return Buffer.from(json, 'utf8').toString('base64url');
}

function signature(secret: string, encoded: string, issuedAt: number, method: string, target: string, body: string): string {
  const message = [DOMAIN, String(issuedAt), method, target, createHash('sha256').update(body).digest('hex'), encoded].join('\n');
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** Builds a header value the way the gateway does. Used by tests and the stand-in gateway. */
export function signPrincipal(o: { secret: string; kind: PrincipalKind; ownerId?: string; method: string; target: string; body: string; issuedAt: number; requestId: string }): string {
  const claim: PrincipalClaim = { version: 1, kind: o.kind, ownerId: o.ownerId ?? '', issuedAt: o.issuedAt, requestId: o.requestId };
  if (!o.secret || !shapeOk(claim as unknown as Record<string, unknown>)) throw new Error('invalid principal claim');
  const encoded = encodeClaim(claim);
  return `${encoded}.${signature(o.secret, encoded, claim.issuedAt, o.method, o.target, o.body)}`;
}

/** Remembers accepted request ids until their window closes. One per process. */
export class ReplayCache {
  private readonly seen = new Map<string, number>();
  private readonly max: number;
  constructor(max = 4096) { this.max = max; }
  accept(id: string, expiresAt: number, now: number): boolean {
    for (const [k, exp] of this.seen) if (exp < now) this.seen.delete(k);
    if (this.seen.has(id) || this.seen.size >= this.max) return false;
    this.seen.set(id, expiresAt);
    return true;
  }
}

/** Verify and consume one header value. Any doubt is `null`. */
export function verifyPrincipal(o: {
  secret: string | null; header: string | undefined; method: string; target: string; body: string; nowSeconds: number; cache: ReplayCache;
}): PrincipalClaim | null {
  const { header } = o;
  if (!o.secret || !header || Buffer.byteLength(header, 'utf8') > MAX_HEADER_BYTES) return null;
  const dot = header.lastIndexOf('.');
  if (dot <= 0 || dot === header.length - 1) return null;
  const encoded = header.slice(0, dot);
  const given = header.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  let claim: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    claim = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (Object.keys(claim).sort().join() !== KEYS.join() || !shapeOk(claim)) return null;
  if (Math.abs(o.nowSeconds - claim.issuedAt) > MAX_SKEW_SECONDS) return null;
  const expected = Buffer.from(signature(o.secret, encoded, claim.issuedAt, o.method, o.target, o.body), 'utf8');
  const got = Buffer.from(given, 'utf8');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  if (!o.cache.accept(claim.requestId, claim.issuedAt + MAX_SKEW_SECONDS, o.nowSeconds)) return null;
  return claim;
}
