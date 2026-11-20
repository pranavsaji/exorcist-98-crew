# Exorcist 98 for Kiro Crew

A [Kiro Crew](https://kiro.dev/docs/crew/) app that patrols your project
folders every night. It scans them with the
[Exorcist 98](https://github.com/pranavsaji/exorcist-98) scanner for text that
tries to take over an AI agent (hidden Unicode, instructions aimed at the AI,
poisoned MCP tool descriptions) and for risky agent and MCP settings. A Crew
dashboard page shows each folder's infection level and every finding down to
the file, line and quoted text.

Companion to the Kiroween 2026 entry
[pranavsaji/exorcist-98](https://github.com/pranavsaji/exorcist-98).

## What it adds to Crew

| Part                                              | What it does                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard page** (`/apps/exorcist-98-crew`)     | Add or remove folders, run a patrol, see an infection level per folder (text label plus shape, never colour alone), open any finding to see where it is, the quoted text and how to fix it. |
| **Nightly patrol** (02:00, in the backend) | Scans every watched folder and sends a Crew notification for new serious findings or failed scans. `EXORCIST_PATROL_HOUR` changes the hour; `off` disables it. |
| **Exorcist Sentry agent** (cron `nightly-patrol`, paused) | Summarises the latest patrol on request. It never starts a scan and never sees the scanned text (see below). The cron is paused because in Crew 0.12.2 an agent has no token for the app's API. |
| **Agent-hygiene skill**                           | Safe habits for any Crew agent that reads repos or uses MCP servers.                                                                                                                        |
| **MCP rug-pull watch** (every patrol) | Reads each folder's Exorcist 98 Shield pin file (`.exorcist/pins.json`) and reports every MCP tool the Shield is holding back because its description changed after it was pinned (critical, EX-006). Read-only: approving stays with `exorcist approve tool`. |
| **Quarantine** (on the page, asks first) | "Move file to vault..." on a finding moves that file into `.exorcist/vault` inside the folder, through the Exorcist 98 Quarantine Vault (exact copy and sha256). "Restore..." puts back the exact bytes. Only you, signed in to the dashboard, can do it: the gateway signs who sent each request, and agents, schedules, MCP tools and other apps are refused. Only files named by the last patrol can be moved; never symlinks or `.exorcist` files. |
| **Backend**                                       | Keeps the folder list, runs the scanner and the rug-pull watch, diffs against the last patrol.                                                                                                                     |

### Screenshots

The page inside a signed-in Crew 0.13.0 dashboard, patrolling the Haunted Repo
from the main repo:

![Watched folders with their infection level](docs/media/page-overview.png)

A changed MCP tool reported from the Shield's pin file:

![Rug-pull finding with quoted text and fix](docs/media/rug-pull-finding.png)

Moving a flagged file to the vault asks first:

![Confirm box before a file moves to the vault](docs/media/quarantine-confirm.png)

A 17-second clip of a patrol: [`docs/media/patrol-clip.mp4`](docs/media/patrol-clip.mp4).

### Why the agent never sees the scanned text

The files being scanned may contain instructions written to hijack an AI. So
the scan is done by the Exorcist 98 scanner (deterministic rules), not by the
agent, and the patrol reply the agent reads holds only file, line, rule,
severity and title. The quoted text is shown to you on the page, inserted as
plain text.

## Install

You need Node 20 or newer and a running Crew gateway.

```sh
git clone https://github.com/pranavsaji/exorcist-98-crew
curl -X POST http://localhost:5476/api/apps/install \
  -H 'Content-Type: application/json' \
  -d "{\"source\": \"$PWD/exorcist-98-crew\"}"
curl -X POST http://localhost:5476/api/apps/exorcist-98-crew/enable
```

Then open **Exorcist 98** in the Crew sidebar, add a project folder (its full
path) and select **Run patrol now**.

### Choosing the scanner

The backend runs `<scanner> scan <folder> --format json --fail-on none` with
no shell and a 120-second limit. In order of preference:

1. `EXORCIST_CLI`: path to the Exorcist 98 CLI bundle, for example
   `/path/to/exorcist-98/packages/cli/dist/index.mjs` (build it with
   `pnpm --filter @exorcist-98/cli build` in the main repo).
2. `cliPath` in a `config.json`, first in Crew's app data folder
   (`~/.kiro/crew/apps/exorcist-98-crew/data/`), then in `~/.exorcist-98-crew/`.
3. Nothing else. There is deliberately no `npx` fallback: `@exorcist-98/cli` is
   not published, and `npx -y` of an unpublished name runs whoever claims it.
   Without 1 or 2, each folder's patrol reports "No Exorcist 98 scanner is set up".

The scanner is never chosen through the app's HTTP API.

### Where data lives

`state.json` in the app's `data/` folder under Crew's home
(`$KIROCREW_HOME/apps/exorcist-98-crew/data`, which Crew keeps across updates),
or `~/.exorcist-98-crew/` when Crew's folder is not found, or the folder named
by `EXORCIST_CREW_DATA`. It holds the folder list and the last patrol's findings.

## Develop

```sh
npm install
npm run build      # ui/dist/index.mjs and backend/dist/server.mjs (both committed)
npm test           # 140 unit and property tests
npm run typecheck
npm run e2e        # Chrome + axe through a stand-in gateway (scripts/preview.mjs)
```

`npm run preview` starts the stand-in gateway on http://127.0.0.1:5480. It
serves the page the way the Crew docs describe and signs requests to the
backend with `X-Crew-Proxy`. It is a test harness, not Crew.

## Status

Run inside Kiro Crew 0.12.2 and 0.13.0 on macOS (2026-11-18 and 19): the app installs,
enables, patrols the Haunted Repo through the gateway proxy, shows its page in
the signed-in dashboard, and sends a Crew notification for new serious
findings. 140 tests pass, and the page passes a 20-step Chrome run with 0 axe
violations through the stand-in gateway.

With a Kiro sign-in, the Sentry agent answers in chat and the agent cron runs.
Neither can read the patrol (the agent has no gateway token), so both point you
to the page; the backend's own notification is what reports new findings.
Not checked yet: the backend's nightly timer on a real clock. See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md);
[`docs/COORDINATION.md`](docs/COORDINATION.md) has the hand-over notes between
work sessions.

## License

Apache-2.0
