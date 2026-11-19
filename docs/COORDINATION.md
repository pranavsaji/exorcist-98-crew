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
