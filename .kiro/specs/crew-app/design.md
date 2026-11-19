# Design: crew-app

## Layout

```
app.json                 manifest (repo root)
package.json             Crew runs `npm install && npm run build` here
agents/exorcist-sentry.json
skills/agent-hygiene/SKILL.md
shared/                  pure logic used by backend, UI and tests
  report.ts              zod schema of the CLI's JSON report, levels, diff, agent summary
  manifest.ts            zod schema of the documented manifest rules
  hmac.ts                X-Crew-Proxy sign and verify
backend/src/             Node HTTP server (no runtime dependencies after bundling)
  server.ts              routes
  store.ts               state files in the data folder
  scanner.ts             runs the CLI with execFile
  main.ts                entry point
backend/dist/server.mjs  committed bundle (backend.entryPoint)
ui/src/index.ts          mount(element): plain DOM, no framework
ui/dist/index.mjs        committed bundle (ui.entry)
scripts/preview.mjs      a stand-in gateway for local testing
scripts/e2e-chrome.mjs   Chrome + axe run of the page through the stand-in
```

## Decisions

- **Plain DOM, no React, no SDK hooks in the page.** The docs say the host
  supplies `react`, `react-dom`, `react/jsx-runtime`, `lucide-react` and
  `@kirocrew/app-sdk` through an import map, and that pages export a `mount`
  function, but no page documents the arguments of `mount` or whether
  `react-dom/client` is mapped. A bundle with no imports at all cannot fail on
  a missing import map entry. The page calls its own backend through the
  documented reverse proxy (`/apps/exorcist-98-crew/api/*`) with `fetch`.
- **The scan is deterministic; the agent only reports.** The cron asks the
  Sentry agent to call `POST /apps/exorcist-98-crew/api/patrol`. The backend
  runs the scanner, diffs and stores results. The agent never decides what is
  scanned or what counts as a finding.
- **No quoted text to the agent.** The patrol response has file, line, rule,
  severity and title. Quoted spans are only shown on the page, inserted with
  `textContent`.
- **Scanner command.** `EXORCIST_CLI` (a path to the CLI's `index.mjs`, run
  with the current Node) or `cliPath` in `~/.exorcist-98-crew/config.json`;
  otherwise `npx -y @exorcist-98/cli@0.1.0`. Never settable over HTTP.
- **Data folder.** `EXORCIST_CREW_DATA`, default `~/.exorcist-98-crew/`. Not
  inside the app folder, because Crew replaces that on update.
- **Port.** `PORT`, default 4598 (the docs say `"port": "auto"` but not how
  the port is passed; `PORT` is the usual convention).
- **Proxy signature.** Verified when the secret file
  `~/.kiro/crew/apps/exorcist-98-crew/.app_secret` exists or
  `EXORCIST_CREW_SECRET` is set. The signed path is the path the backend
  receives. With no secret the backend still only listens on 127.0.0.1.
- **Routes.** The backend accepts its routes with or without the
  `/apps/exorcist-98-crew/api` prefix, because the docs do not say whether the
  proxy strips it.

## Routes

| Method | Path | Body | Result |
|--------|------|------|--------|
| GET | `/health` | | `{ ok: true }` |
| GET | `/status` | | folders, last patrol, findings with spans (for the page) |
| POST | `/folders` | `{ path }` | 201, or 400 with a plain reason |
| DELETE | `/folders?path=` | | 204 or 404 |
| POST | `/patrol` | | agent summary (no spans), or 409 if one is running |

## Infection levels

| Worst severity | Label | Shape |
|---|---|---|
| none | CLEAN | check |
| low | LOW | circle |
| medium | MEDIUM | square |
| high | HIGH | triangle |
| critical | CRITICAL | diamond |

Same labels and shapes as the main web app.
