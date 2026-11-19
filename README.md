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
| **Nightly patrol** (cron `nightly-patrol`, 02:00) | Asks the Sentry agent to start a patrol and report new serious findings.                                                                                                                    |
| **Exorcist Sentry agent**                         | Starts the patrol and reports what it returns. It never sees the scanned text (see below).                                                                                                  |
| **Agent-hygiene skill**                           | Safe habits for any Crew agent that reads repos or uses MCP servers.                                                                                                                        |
| **Backend**                                       | Keeps the folder list, runs the scanner, diffs against the last patrol.                                                                                                                     |

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
2. `cliPath` in `~/.exorcist-98-crew/config.json`, same meaning.
3. `npx -y @exorcist-98/cli@0.1.0`. **Not published to npm yet**, so for now
   use 1 or 2.

The scanner is never chosen through the app's HTTP API.

### Where data lives

`~/.exorcist-98-crew/state.json` (or `EXORCIST_CREW_DATA`): the folder list and
the last patrol's findings. Outside the app folder, because Crew replaces that
folder on update.

## Develop

```sh
npm install
npm run build      # ui/dist/index.mjs and backend/dist/server.mjs (both committed)
npm test           # 83 unit and property tests
npm run typecheck
npm run e2e        # Chrome + axe through a stand-in gateway (scripts/preview.mjs)
```

`npm run preview` starts the stand-in gateway on http://127.0.0.1:5480. It
serves the page the way the Crew docs describe and signs requests to the
backend with `X-Crew-Proxy`. It is a test harness, not Crew.

## Status

Built and tested outside Crew: 83 tests pass (including a scan of the Haunted
Repo with the real Exorcist 98 CLI), and the page passes a 16-step Chrome run
with 0 axe violations through the stand-in gateway.

**Not yet run inside Kiro Crew.** Crew was not installed on the development
machine. See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) for
every assumption about Crew that still has to be checked.

## License

Apache-2.0
