import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { signProxy, verifyProxy } from '../shared/hmac.js';

const NOW = 1_795_000_000;
const req = fc.record({
  secret: fc.string({ minLength: 1, maxLength: 40 }),
  method: fc.constantFrom('GET', 'POST', 'DELETE'),
  path: fc.constantFrom('/patrol', '/status', '/folders?path=%2Ftmp', '/apps/exorcist-98-crew/api/patrol'),
  body: fc.string({ maxLength: 60 }),
});

describe('PBT-CRW-03 proxy signature', () => {
  it('a signature made with the secret verifies', () => {
    fc.assert(fc.property(req, (r) => {
      const header = signProxy(r.secret, String(NOW), r.method, r.path, r.body);
      expect(verifyProxy({ secret: r.secret, header, method: r.method, pathAndQuery: r.path, body: r.body, nowSeconds: NOW })).toBe(true);
    }));
  });

  it('changing the method, path, body or secret makes it fail', () => {
    fc.assert(fc.property(req, fc.constantFrom('method', 'path', 'body', 'secret'), (r, what) => {
      const header = signProxy(r.secret, String(NOW), r.method, r.path, r.body);
      const v = {
        secret: what === 'secret' ? `${r.secret}x` : r.secret,
        method: what === 'method' ? (r.method === 'GET' ? 'POST' : 'GET') : r.method,
        pathAndQuery: what === 'path' ? `${r.path}/x` : r.path,
        body: what === 'body' ? `${r.body}x` : r.body,
      };
      expect(verifyProxy({ ...v, header, nowSeconds: NOW })).toBe(false);
    }));
  });

  it('rejects old timestamps, missing headers and junk', () => {
    const h = signProxy('s', String(NOW - 61), 'GET', '/status', '');
    expect(verifyProxy({ secret: 's', header: h, method: 'GET', pathAndQuery: '/status', body: '', nowSeconds: NOW })).toBe(false);
    for (const header of [undefined, '', 'abc', ':', `${NOW}:`, `x${NOW}:00`]) {
      expect(verifyProxy({ secret: 's', header, method: 'GET', pathAndQuery: '/status', body: '', nowSeconds: NOW })).toBe(false);
    }
  });

  it('accepts millisecond timestamps within the window', () => {
    const h = signProxy('s', String(NOW * 1000), 'GET', '/status', '');
    expect(verifyProxy({ secret: 's', header: h, method: 'GET', pathAndQuery: '/status', body: '', nowSeconds: NOW + 10 })).toBe(true);
  });
});
