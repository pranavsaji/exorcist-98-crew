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

