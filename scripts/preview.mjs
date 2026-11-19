// A stand-in for the Crew gateway, for local testing only. It serves the page
// bundle at /apps/exorcist-98-crew/ui/*, mounts it at /, and forwards
// /apps/exorcist-98-crew/api/* to the backend with an X-Crew-Proxy signature
// made the way the Crew SDK reference describes. It is not Crew.
//
//   EXORCIST_CLI=/path/to/exorcist-98/packages/cli/dist/index.mjs npm run preview
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'exorcist-98-crew';

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Exorcist 98 (Crew preview)</title><style>body{margin:0;background:#2b2b2b}</style></head>
<body><main id="app"></main>
<script type="module">
  import { mount } from '/apps/${APP}/ui/dist/index.mjs';
  mount(document.getElementById('app'));
</script></body></html>`;

function sign(secret, method, pathAndQuery, body) {
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const mac = createHmac('sha256', secret).update(`${ts}:${method}:${pathAndQuery}:${bodyHash}`).digest('hex');
  return `${ts}:${mac}`;
}

export async function startPreview({ port = 5480, backendPort = 5481, cli = process.env.EXORCIST_CLI } = {}) {
  const secret = randomBytes(24).toString('hex');
  const data = mkdtempSync(join(tmpdir(), 'x98-crew-preview-'));
  const env = { ...process.env, PORT: String(backendPort), EXORCIST_CREW_DATA: data, EXORCIST_CREW_SECRET: secret };
  if (cli) env.EXORCIST_CLI = cli;
  const backend = spawn(process.execPath, [join(ROOT, 'backend/dist/server.mjs')], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  for (let i = 0; i < 50; i++) {
    const up = await new Promise((r) => {
      const q = request({ host: '127.0.0.1', port: backendPort, path: '/health', headers: { 'x-crew-proxy': sign(secret, 'GET', '/health', '') } }, (res) => { res.resume(); r(res.statusCode === 200); });
      q.on('error', () => r(false));
      q.end();
    });
    if (up) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const uiRoot = join(ROOT, 'ui');
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
      return;
    }
    if (url.pathname.startsWith(`/apps/${APP}/ui/`)) {
      const file = normalize(join(uiRoot, url.pathname.slice(`/apps/${APP}/ui/`.length)));
      if (!file.startsWith(uiRoot + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
      const type = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(readFileSync(file));
      return;
    }
    if (url.pathname.startsWith(`/apps/${APP}/api/`)) {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const path = `${url.pathname}${url.search}`;
        const headers = { 'content-type': req.headers['content-type'] ?? 'application/json', 'x-crew-proxy': sign(secret, req.method, path, body) };
        const out = request({ host: '127.0.0.1', port: backendPort, path, method: req.method, headers }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        out.on('error', () => res.writeHead(502).end());
        out.end(body);
      });
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${port}/`,
    data,
    async close() {
      backend.kill();
      await new Promise((r) => server.close(r));
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const p = await startPreview();
  process.stderr.write(`Preview at ${p.url} (stand-in gateway, not Crew). Ctrl+C to stop.\n`);
  process.on('SIGINT', () => { void p.close().then(() => process.exit(0)); });
}
