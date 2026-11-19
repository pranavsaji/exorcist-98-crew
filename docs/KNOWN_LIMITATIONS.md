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
| C-012 | Low | Verified | There is no notification or sidebar badge for new findings; only the agent's cron reply. | Use `useNotify`/`useNavBadge` or the notification API. |
| C-013 | Low | Verified | Patrols scan folders one at a time with no overall time limit (each scan has 120 seconds). Twenty slow folders could take 40 minutes. | Add an overall limit or run scans in parallel. |
| C-014 | Low | Verified | The app has no icon, screenshots or hero images for the App Store listing. | Add them before submitting to the registry. |
| C-015 | Low | Verified | `docs/PLAN.md` section 3 lists a Vite + React UI. The page is plain DOM bundled with esbuild (see `docs/MANIFEST_CHECK.md`). | Move to React after C-002 is checked in Crew, if wanted. |
| C-016 | Medium | Unverified | `permissions.api` holds the app's own proxy path. The docs describe it as gateway API prefixes (`/api/crons`), and the page does not use `useAppApi`. It may be unnecessary. | In Crew, remove it and check that the page still loads. |
| C-017 | Low | Unverified | The `validate-app-json` hook runs `npx vitest` relative to the working directory the IDE gives it, assumed to be the repo root. | Save `app.json` in the IDE and check that the test output appears. |
