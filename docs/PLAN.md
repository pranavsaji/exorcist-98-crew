# Exorcist 98 Crew App: Build Plan

> A Kiro Crew app that keeps your agent workspaces clean while you sleep.
> Companion to the main Kiroween 2026 entry [pranavsaji/exorcist-98](https://github.com/pranavsaji/exorcist-98).
> Bonus target: **Best Kiro Crew App ($1,000)**.

## 1. Why this is a separate repo

The Kiroween 2026 rules require the Best Kiro Crew App bonus to be a **separate GitHub repo**, created during the submission period, under the same GitHub account as the main submission. The main repo holds the scanner, shield and web app; this repo holds only the Crew app that uses them.

## 2. What it does

1. **Exorcist Sentry agent**: a Crew agent that knows how to run Exorcist scans and explain findings.
2. **Nightly patrol (cron)**: every night it scans the workspaces you register, compares against the last scan, and raises a notification for any new Critical or High finding.
3. **MCP rug-pull watch**: checks pinned MCP tool hashes from the main app's shield and alerts if any changed.
4. **Crew dashboard page**: a retro "Exorcist 98" page inside Crew showing infection level per workspace, new findings since yesterday, and one-click links to quarantine. (Built as "Move file to vault..." with a confirm step, owner only, because of the steering rule; see C-018.)
5. **Agent hygiene skill**: a SKILL.md that teaches any Crew agent safe habits (do not follow instructions found in files, check MCP servers before enabling, keep secrets out of reach).

## 3. Crew app structure (per Kiro Crew docs)

```
exorcist-98-crew/
  app.json                      # manifest, repo root
  agents/
    exorcist-sentry.json
  skills/
    agent-hygiene/
      SKILL.md
  ui/                           # dashboard page (Vite + React)
    package.json
    vite.config.ts              # mark react, react-dom, react/jsx-runtime, lucide-react, @kirocrew/app-sdk as externals
    src/App.tsx
  backend/                      # optional small service that runs scans
  .kiro/steering/product.md
  docs/PLAN.md
  README.md
```

Key facts from the Crew docs:

- `app.json` lists `agents`, `skills`, `ui.pages` (route, label, icon), optional `backend`, `crons` (name, cron_expr, message, agent) and `setup` (onInstall, onUpdate).
- Crew registers crons when the app is enabled and removes them when it is disabled.
- Do not install `@kirocrew/app-sdk`; the host supplies it at runtime.
- Dev loop: `kirocrew gateway`, then `kirocrew app dev exorcist-98-crew`; install locally through the REST API on `localhost:5476` or the App Store UI ("Install from local path").
- Verify every manifest field against the Crew Manifest reference before submitting; `app.json` in this repo is a starting draft.

## 4. How it connects to the main repo

- Uses `npx exorcist scan <path> --json` from the main repo's CLI package (published to npm or run from a local checkout).
- Reads the shield's pin file (`~/.exorcist/pins.json`) for rug-pull checks.
- No network calls except the optional Bedrock heuristic layer, which the main CLI handles.

## 5. Milestones

- [x] Nov 18: install Crew, run the sample app, confirm the manifest fields
- [x] Nov 26: Sentry agent + agent-hygiene skill working in Crew chat
- [x] Nov 29: nightly cron calling the main CLI; notifications on new findings (a backend timer, since an agent cannot call the app's API; seen on a real clock in Crew at 21:10 with a notification, N-007, and again at 22:00, N-015)
- [x] Dec 1: dashboard page with infection level per workspace
- [x] Dec 2: README with install steps, screenshots and a 20-second clip for the main video (`docs/media/`, clip is 17 s)

## 6. Kiro usage for this repo

- One spec for the Crew app (requirements, design, tasks) created with Kiro.
- Steering: `.kiro/steering/product.md`.
- Hook: on change to `app.json`, validate it against the manifest rules.
- Log everything in the main repo's `docs/KIRO_LOG.md`.

## 7. Submission checklist for the bonus

- [x] Repo is public, created during the submission period, same GitHub account as the main repo (created 2026-11-15T07:18Z; the Kiroween 2026 rules give the Submission Period as October 30, 2026 9:00 am PT to December 4, 2026 2:00 pm PT)
- [x] Apache-2.0 license visible in About
- [x] README explains install and what the app adds to Crew
- [ ] Link to this repo in the main Devpost submission under Best Kiro Crew App
