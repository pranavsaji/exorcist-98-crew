import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The Crew gateway signs proxied requests with
 * `X-Crew-Proxy: <timestamp>:<hex hmac>` where the HMAC-SHA256 key is the app
 * secret and the message is `timestamp:METHOD:/path[?query]:sha256(body)`
 * (Crew SDK reference). Timestamps must be within 60 seconds.
 */
export function proxyMessage(timestamp: string, method: string, pathAndQuery: string, body: string): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  return `${timestamp}:${method.toUpperCase()}:${pathAndQuery}:${bodyHash}`;
}

export function signProxy(secret: string, timestamp: string, method: string, pathAndQuery: string, body: string): string {
  const mac = createHmac('sha256', secret).update(proxyMessage(timestamp, method, pathAndQuery, body)).digest('hex');
  return `${timestamp}:${mac}`;
}

export type VerifyInput = {
  secret: string;
  header: string | undefined;
  method: string;
  pathAndQuery: string;
  body: string;
  nowSeconds: number;
};

export function verifyProxy(input: VerifyInput): boolean {
  if (!input.header) return false;
  const sep = input.header.indexOf(':');
  if (sep <= 0) return false;
  const timestamp = input.header.slice(0, sep);
  if (!/^\d{1,13}$/.test(timestamp)) return false;
  // Accept seconds or milliseconds, since the docs do not say which.
  const ts = Number(timestamp);
  const seconds = ts > 1e11 ? ts / 1000 : ts;
  if (Math.abs(input.nowSeconds - seconds) > 60) return false;
  const expected = Buffer.from(signProxy(input.secret, timestamp, input.method, input.pathAndQuery, input.body));
  const given = Buffer.from(input.header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
