# Known limitations

Gaps and unchecked assumptions, so they can be fixed later. Confidence:
*Verified* (seen by running or reading code), *Unverified* (an assumption
about Crew that has not been tested in Crew).

| ID | Priority | Confidence | Limitation | Suggested fix |
|----|----------|------------|------------|---------------|
| C-001 | High | Unverified | **The app has never run inside Kiro Crew.** `kirocrew` was not installed. Everything was tested with unit tests and a stand-in gateway (`scripts/preview.mjs`). | Install Crew, install the app from a local path, run `kirocrew doctor`, open the page, run the cron once. |
| C-002 | High | Unverified | The signature of `mount` is not documented. The page assumes `mount(element)` and returns a cleanup function. | Check against a sample Crew app; adjust the export. |
| C-003 | High | Unverified | How the backend is told its port (`"port": "auto"`) is not documented. The backend reads `PORT` and defaults to 4598. | Check what Crew passes; read that variable. |
| C-004 | High | Unverified | The `X-Crew-Proxy` check follows the SDK reference, but these details are guessed: the timestamp unit (both seconds and milliseconds are accepted), which path is signed (the path the backend receives), the secret's location (`~/.kiro/crew/apps/exorcist-98-crew/.app_secret`). If any is wrong, every request gets 401 inside Crew. | Log one real header in Crew and compare. `EXORCIST_CREW_SECRET` can override the secret. |
| C-005 | Medium | Unverified | Whether the proxy strips the `/apps/exorcist-98-crew/api` prefix is not documented. The backend accepts both forms. | Confirm and drop the other form. |
| C-006 | Medium | Unverified (docs agree, 2026-11-18) | `ui.entry` is described as relative to the app root, but the publishing guide says to commit `ui/dist/index.mjs` and dev mode watches `ui/`. The app uses `ui/dist/index.mjs` with `"entry": "dist/index.mjs"`, as in every example. | Confirm in Crew. |
| C-007 | Medium | Unverified | The cron asks the agent to call `POST http://localhost:5476/apps/exorcist-98-crew/api/patrol`. Whether the agent's tools (`@kirocrew-core`) can make that request, and whether the gateway needs a token for it, is unknown. | Run the cron once; if needed, give the agent a fetch or shell tool, or have the backend run the patrol on a timer. |
| C-008 | Medium | Verified | The Exorcist 98 CLI is not published to npm, so the default scanner (`npx -y @exorcist-98/cli@0.1.0`) fails until it is. Set `EXORCIST_CLI` or `cliPath`. | Publish the CLI. |
| C-009 | Medium | Verified | The MCP rug-pull watch from `docs/PLAN.md` (reading the Shield's pin file) is not built. The patrol only scans folders. | Read `.exorcist/pins.json` in each folder and report changed tools. |
| C-010 | Low | Verified | Only the 500 worst findings per folder are stored. In a folder with more, the ones beyond 500 count as new on every patrol. | Store keys for all findings, details for the first 500. |
| C-011 | Low | Verified | The page does not use the Crew SDK hooks or UI components and draws its own retro styling, so it does not follow the Crew theme. Chosen so the bundle has no imports that could fail (see `design.md`). | Use `useTheme` and the SDK components once C-002 is checked. |
| C-012 | Low | Fixed | New serious findings and failed scans now raise a Crew notification on the `new-threats` channel: counts, files, lines and rule names, never quoted text. Seen in Crew 0.12.2: "Exorcist 98: 38 new serious problems found", priority critical. No sidebar badge yet. | Add `useNavBadge` if wanted. |
| C-013 | Low | Verified | Patrols scan folders one at a time with no overall time limit (each scan has 120 seconds). Twenty slow folders could take 40 minutes. | Add an overall limit or run scans in parallel. |
| C-014 | Low | Verified | The app has no icon, screenshots or hero images for the App Store listing. | Add them before submitting to the registry. |
| C-015 | Low | Verified | `docs/PLAN.md` section 3 lists a Vite + React UI. The page is plain DOM bundled with esbuild (see `docs/MANIFEST_CHECK.md`). | Move to React after C-002 is checked in Crew, if wanted. |
| C-016 | Medium | Unverified | `permissions.api` holds the app's own proxy path. The docs describe it as gateway API prefixes (`/api/crons`), and the page does not use `useAppApi`. It may be unnecessary. | In Crew, remove it and check that the page still loads. |
| C-017 | Low | Unverified | The `validate-app-json` hook runs `npx vitest` relative to the working directory the IDE gives it, assumed to be the repo root. | Save `app.json` in the IDE and check that the test output appears. |

## Result of installing in Crew 0.12.2 (2026-11-18, macOS)

Installed with the official `cli.sh` installer, then
`POST /api/apps/install` and `/enable` on `localhost:5476`.
"Seen" means observed on the running gateway; "read" means read in the
installed Crew package source.

| ID | Result |
|----|--------|
| C-001 | **Partly verified.** Install and enable succeed. Agent `exorcist-98-crew/exorcist-sentry`, skill `agent-hygiene` and cron `nightly-patrol` are registered (seen); disabling removes the job and enabling re-adds it (seen). A patrol through the gateway proxy scanned the Haunted Repo and returned its findings (seen). **Not checked:** the Sentry agent answering in chat, and the cron firing. Those need a Kiro sign-in, which this machine does not have. The page itself is now checked (see C-002). |
| C-002 | **Was wrong, fixed.** The dashboard does `React.lazy(() => import(entry))` and renders the module's default export as a React component with no props; `mountFunction` is not used (seen in the dashboard source). `ui/src/crew.ts` is now the entry (`ui.entry` = `dist/crew.mjs`) and hosts the plain-DOM `mount`. Checked in a signed-in Chrome: the page renders, a folder can be added, "Run patrol now" ran and showed `CRITICAL` with 38 serious and 2 minor findings, with no page errors. |
| C-003 | **Verified.** The gateway starts the backend with `PORT=9100` (seen). |
| C-004 | **Was wrong, fixed.** The header is `X-KiroCrew-Proxy`, not `X-Crew-Proxy` (read: `apps/routes_proxy.py`). Every real request would have got 401. Timestamp is in seconds and the signed path is the request-target the backend receives (read). The backend now accepts both names. The secret is also given in `KIROCREW_PROXY_SECRET`; the `.app_secret` file location was right. |
| C-005 | **Verified.** The gateway forwards `/apps/<name>/api/<path>` as `/api/<path>`; the backend handles that form (seen: `/health` and `/status` answered 200 through the proxy). |
| C-006 | **Verified.** `ui.entry` `dist/index.mjs` is served from `ui/dist/index.mjs`. |
| C-007 | **Confirmed, worked around.** A request without the dashboard token gets `403 Token required`, so an agent cannot start a patrol through the proxy. The backend now patrols by itself every night at 02:00 local time (`EXORCIST_PATROL_HOUR`, `off` to disable) and sends a Crew notification. The agent cron is kept but registered paused, and its message no longer asks the agent to start a scan. |
| C-016 | **Verified: not needed.** With `permissions` reduced to `{"cron": true}` the page still loads and calls `/apps/exorcist-98-crew/api/status` (HTTP 200). `permissions.api` was removed from `app.json`. |

Found only by installing (not in the Manifest reference):

- **N-001** The gateway refuses an app with `crons` and no `permissions.cron: true`. Fixed in `app.json` and in `shared/manifest.ts`, with a test.
- **N-002** The gateway probes `/health` without a signature. The backend answered 401 until `/health` was moved before the signature check (fixed in `backend/src/server.ts`, with a test). The gateway then listed the backend as reachable.
- **N-003** Enabling a third-party app is refused until it is trusted (`agent.apps_trusted`). This machine's config now trusts only `exorcist-98-crew`.
- **N-004** The backend reads its scanner path once at start. Adding `cliPath` to `~/.exorcist-98-crew/config.json` needs a disable and enable to take effect.


Accessibility inside Crew: axe on the full dashboard page reports 4 `label-content-name-mismatch` violations. All four are Crew's own top-bar buttons (Command Bar, resource health, update pill, notifications), none are in this app's page.
- **N-005** App notifications need three things the docs do not list: exchange the app secret for a token (`POST /api/apps/<name>/token` with `X-App-Secret`), send that token as the `mc_token_<port>` cookie (the gateway ignores `Authorization: Bearer` and answered `403 Token required`), and declare the channel under `notifications.channels` in `app.json`. Fixed in `backend/src/notify.ts`, with tests; seen working in Crew 0.12.2.
- **N-006** A trust grant (`agent.apps_trusted`) made before installing is refused at install ("execution trust predates repository binding"). Install first, then trust, then enable.
- **N-007** The nightly patrol in the backend has run only in unit tests (a fake timer). The patrol it calls is the same one the page runs, and that one was seen sending a notification in Crew.
- **N-008** On the main gateway the agent cron fired at 02:57 and failed because the Sentry agent was not registered at the time ("agent definition ... is missing"); an update registered it. Crew applies a manifest's `enabled: false` only when it creates the job, so an existing job stays enabled after an update. Paused by hand; new installs get it paused.
