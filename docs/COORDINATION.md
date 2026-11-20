# Notes between work sessions

Two Kiro sessions have worked on this repository at the same time. Neither
can message the other, so this file is how they hand over. Read it before you
start, add a dated entry when you stop, and do not commit another session's
half-done edits.

## Rules we follow

- `git fetch` and `git status` before editing. If a file has uncommitted
  changes you did not make, leave them alone or ask the user.
- Each session tests Crew on its own gateway: the main one is
  `~/.kiro/crew` on port 5476; the test one is `~/.x98-crew-test/home` on
  port 5490 (`zsh ~/.x98-crew-test/gw.sh`). Do not reinstall or reconfigure
  the other one's gateway.
- Record what Crew really does (versus the docs) in
  `docs/KNOWN_LIMITATIONS.md`, as C-0xx results or N-0xx findings.

## 2026-11-19, session B (port 5490)

Picked up from `d13cb2a` (session A's "run in Crew 0.12.2" commit), which
already contained the fixes both sessions found yesterday (cron permission,
`X-KiroCrew-Proxy`, unsigned `/health`, React default export, secret and data
folder from `KIROCREW_HOME`).

Done:
- **C-007 worked around.** The agent has no gateway token, so it cannot start
  a patrol. The backend now patrols itself nightly (`backend/src/schedule.ts`)
  and pushes a Crew notification (`backend/src/notify.ts`). The agent cron is
  registered paused, with a message that no longer starts a scan.
- **C-012 fixed.** Notifications seen in Crew 0.12.2 on port 5490 (N-005).
- Scanner config is read from Crew's app `data/config.json`, then
  `~/.exorcist-98-crew/config.json`, so session A's setup keeps working.
- 103 tests and the 16-step browser run pass.

Not done, for whoever is next:
- Session A's gateway (5476) still runs the older install. Run
  `kirocrew app update exorcist-98-crew --source <repo>` there to get the
  notifications.
- The Sentry agent in chat and a cron firing need a Kiro sign-in.
- The nightly timer has only run under a fake clock (N-007).

## 2026-11-19, session B, on the main gateway (port 5476), at the user's request

The user asked for both setups to be brought in line, so session B updated
the main gateway this once.

- `kirocrew app update exorcist-98-crew --source <repo>` at `947822e`. The
  backend now logs "nightly patrol at 2:00; notifications on". The Sentry
  agent registered ("Agents registered: 1").
- **The agent cron had fired at 02:57 and failed:** "The agent
  exorcist-sentry ... is missing" (N-008). It was still enabled, because Crew
  applies a manifest's `enabled: false` only when a job is created. Paused it
  with `kirocrew cron pause ccb80f36` (undo with `kirocrew cron resume ccb80f36`).
- Patrol through the proxy: Haunted Repo still CRITICAL (17 critical,
  21 high, 2 medium), nothing new against the existing baseline, so no
  notification (correct).
- Notification check: a temporary defanged folder
  (`~/.x98-crew-test/main/sample`) gave "Exorcist 98: 2 new serious problems
  found" (priority default, both HIGH). The folder was removed afterwards; the
  watched list is the Haunted Repo only, as before.
- Page in Chrome on the signed-in main dashboard: loads, CRITICAL label,
  finding opens with quote and fix, Run patrol now works, 0 axe violations,
  no app errors.
- Crew shows "Update ready". Not applied: that is the user's call.

Both gateways now run the same code (`947822e`). Still unchecked: the Sentry
agent answering in chat (needs a Kiro sign-in).

## 2026-11-19, session A, on the main gateway (port 5476, Crew 0.13.0)

- Kiro sign-in done by the user (Google, device code). `GET /api/kas-login`
  reports `authenticated: true`.
- Sentry agent in chat: answers, but its prompt still said `POST /patrol`, so
  it said it had no tool for that. Prompt rewritten (backend patrols and
  notifies; never guess results). After `kirocrew app update`, it explains
  the nightly patrol and points to the page (N-009).
- Ran the paused cron once by hand (`POST /api/crons/ccb80f36/run`): status
  success, same answer. Left paused.
- Sample app: `kirocrew app init x98-sample-app --backend --ui --cron` in
  `/tmp/x98-sample`, sample cron set `enabled: false`, installed, trusted,
  enabled, page checked, then disabled and its trust removed. Still installed
  (disabled); uninstall with `kirocrew app uninstall x98-sample-app` (N-010).
- Ticked the Nov 18 line in `docs/PLAN.md`.


## 2026-11-19 evening, session A (port 5476)

Committed only my own hunks. Session B's uncommitted work was left as it is:
`mcp/patrol_status.py`, `tests/mcp.test.ts`, the `agents/exorcist-sentry.json`
change, `mcpServers` in `app.json` and the `patrol_status` asserts in
`tests/manifest.test.ts`.

- **Rug-pull watch built (C-009).** `shared/pins.ts`, `backend/src/pins.ts`,
  `tests/pins.test.ts` (PBT-CRW-06). Seen in Crew 0.13.0 with a pin file
  written by the Shield's own `saveState`.
- **No more `npx` fallback for the scanner (C-008).** `@exorcist-98/cli` is
  unpublished, so `npx -y` of it would run whoever claims the name. The skill
  no longer recommends it either.
- Screenshots and a 17-second clip in `docs/media/`, listed in `app.json`.
- Plan ticks: Nov 26, Dec 1, Dec 2, and two of the bonus checklist lines.
- **ID clash avoided:** my findings are N-013 and N-014, because your test
  comment already uses N-011 for the MCP server.
- **Heads-up:** my `kirocrew app update` on 5476 at about 20:15 copied the
  working tree, so the main gateway may now be running your unfinished
  `mcpServers` entry and the agent prompt that calls `patrol_status`. Run the
  update again from your committed state when you are done.

## 2026-11-19, session B, after session A's `072c109`

Read session A's entry first; nothing in it was redone.

- Crew on the main gateway: restarted onto 0.13.0 (the 0.12.2 process was
  still running) after a snapshot backup in `~/.x98-crew-test/backup/`.
  Patrol, notification and page rechecked on 0.13.0: all pass.
- **N-011:** the Sentry agent answered "I can't reach the results" (N-009),
  so it now has a read-only MCP tool, `patrol_status`. Seen working in an
  interactive chat after one approval. Agent prompt keeps every rule session
  A added; `tests/mcp.test.ts` runs the real server over stdio.
- Cron message now names `patrol_status`, no URL. Cron left paused.

Still open:
- Unattended use of `patrol_status` (cron) needs an approval Crew cannot ask
  for in the background; decide whether to pre-approve the tool.
- N-007 nightly timer on a real clock; C-017 hook on an IDE save.
- `x98-sample-app` is still installed (disabled) on the main gateway.

## 2026-11-19 21:05, session A (port 5476)

- Checked that the main gateway runs session B's committed code (`07acc94`):
  `app.json`, the agent, `mcp/patrol_status.py` and both bundles match.
- App Store art (C-014): `assets/icon.png`, `assets/hero-light.png`,
  `assets/hero-dark.png`, named in `app.json`; size checks in
  `tests/foundation.test.ts`. Updated on 5476; Crew serves the icon at
  `/apps/exorcist-98-crew/art/assets/icon.png` (200).

## 2026-11-19 21:20, session B (main gateway, at the user's request)

Built on session A's `7981273` (App Store art); nothing of it changed.

- **N-007 done:** patrol watched firing on a real clock (21:10:00), with a
  notification. New `patrolTime` in the app's `data/config.json`; that file was
  removed afterwards, so the main gateway is back at 02:00.
- **N-012 done:** only `patrol_status` is pre-approved in the agent spec; a
  triggered cron run succeeded unattended with correct results and no quoted
  text. The cron is now **enabled at 02:15** (manifest), job `1e89f00f`.
- Not changed: `x98-sample-app` (still installed, disabled).

## 2026-11-19 22:05, session A

- Hook C-017 verified: an agent edit of `app.json` in the IDE triggered
  `validate-app-json` (vitest results rewritten 8 s later with only
  `tests/manifest.test.ts`). The edit was reverted at once.
- Timer checked once more outside Crew (N-015): 22:00:00.126, 40 findings. With
  your N-007 this ticks Nov 29 in the plan.
- Submission-period line ticked: repo created 2026-11-15, period is
  2026-10-30 to 2026-12-04 (Kiroween 2026 rules).
- Uninstalled `x98-sample-app` from 5476 with `--purge-data`; trust list is
  `["exorcist-98-crew","personal-shopper"]`.

## 2026-11-20 09:40, session A (port 5476)

- **Quarantine from the page (C-018)**, confirm-first, owner only. New:
  `shared/principal.ts` (verifies `X-KiroCrew-Principal`), `backend/src/vault.ts`
  (target checks, runs `exorcist vault`), routes `/quarantine` and `/restore`,
  page confirm boxes, `backend.signedPrincipal: true` in `app.json`.
  Scans now pass `--ignore .exorcist/vault`.
- The stand-in gateway (`scripts/preview.mjs`) now signs an owner-session
  principal and forwards `x-exorcist-action`; `npm run e2e` is 20 steps.
- The Mac restarted at about 05:30 and stopped the gateway on 5476. I started
  it again with `kirocrew gateway` in the background. The 02:00 patrol had
  run (N-016).
- Please do not give the Sentry agent or `patrol_status` any way to call
  `/quarantine` or `/restore`; the backend refuses `agent-tool` callers anyway.
- 10:06: the main gateway (5476) now runs as a launchd service
  (`kirocrew service install`), not a background `kirocrew gateway`. Use
  `kirocrew restart` / `kirocrew service status`, and do not start a second
  gateway on 5476.

## 2026-11-20, session B

Read session A's `e131dc8`, `5c215c9` (page quarantine) and `c17e944`
(launchd service). Nothing of them changed; 140 tests pass on `c17e944`.

- **N-017:** the 02:15 agent cron ran on schedule last night and succeeded
  unattended, reporting the 02:00 patrol with no quoted text.
- AWS (main repo L-020): the new account exists, but neither CLI sign-in
  (`aws login --profile exorcist-98`, CLI 2.41.2 in `~/aws-cli`) was approved
  in the browser before it expired, so there are still no CLI credentials.
  Not restarted, at the user's request.
