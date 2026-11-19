# Manifest check (M0)

Every field in `app.json` compared with the Crew Manifest reference
(https://kiro.dev/docs/crew/apps/manifest/, page fetched 2026-11-18) and the
Publishing guide (https://kiro.dev/docs/crew/apps/publishing/).

**Scope of this check:** it compares `app.json` with the documentation and
runs the install-time rules in `shared/manifest.ts`. Crew 0.12.2 also accepted
the file on install and enable (2026-11-18), after the `permissions.cron` fix.

| Field | Value | Documented | Result |
|-------|-------|------------|--------|
| `name` | `exorcist-98-crew` | Required, kebab-case, enforced at install | OK |
| `version` | `0.1.0` | Required, semver `X.Y.Z`, enforced at install | OK |
| `displayName` | `Exorcist 98` | Required, non-empty | OK |
| `description` | one sentence | Required, non-empty | OK |
| `author` | `pranavsaji` | Optional; the publishing checklist asks for it | OK |
| `license` | `Apache-2.0` | Optional | OK |
| `tags` | 4 strings | Optional | OK |
| `highlights` | 4 strings | Optional, max 10 | OK |
| `agents` | `agents/exorcist-sentry.json` | Relative path, contained, must exist | OK |
| `skills` | `skills/agent-hygiene` | Path to a skill directory | OK |
| `backend.entryPoint` | `backend/dist/server.mjs` | "Script to run"; relative and contained | OK. Docs only show a `.py` example; `.mjs` with `type: "node"` is allowed by the `type` list. Not run in Crew. |
| `backend.type` | `node` | One of `python`, `asgi`, `node`, `exec`, `""` | OK |
| `backend.port` | `auto` | Number or `"auto"` | OK. How the port reaches the process is not documented (C-003). |
| `backend.healthCheck` | `/health` | Default `/health` | OK (equals the default; kept to be explicit) |
| `backend.routes` | not set | Optional base route path | Left out: the docs do not say what it changes, and the proxy path is documented as `/apps/{name}/api/*`. |
| `ui.entry` | `dist/crew.mjs` | Served from `ui/dist/`. The host renders the module's **default export as a React component** (C-002). | OK, seen working in Crew 0.12.2 |
| `ui.pages[0].route` / `label` | `/apps/exorcist-98-crew` / `Exorcist 98` | Required | OK |
| `ui.pages[0].icon` | `Shield` | Lucide icon name; `Shield` appears in the docs | OK |
| `permissions.api` | removed | Gateway API prefixes | Removed after testing in Crew 0.12.2: the page reaches its own backend through the proxy without it (C-016). |
| `permissions.cron` | `true` | Can create cron jobs | **Required by Crew 0.12.2** when `crons` is declared; the reference does not say so (N-001). |
| `crons[0]` | `nightly-patrol`, `cron_expr`, `message`, `agent` | `name`, exactly one of `every` or `cron_expr`, `message`, optional `agent` | OK |
| `setup` | not set | Optional | **Left out on purpose.** Crew runs `npm install && npm run build` itself after cloning (Publishing guide), the bundles are committed, and the backend has no runtime dependencies, so no `onInstall` step is needed. |
| `minKiroCrewVersion` | not set | Optional | Left out: the lowest version that works is unknown. |
| `iconPath`, `screenshots`, `heroImage*` | not set | Optional, for the App Store listing | Left out; see C-014. |

Rules from "Enforced at install time" and where they are tested:

| Rule | Test |
|------|------|
| `name` kebab-case | `tests/manifest.test.ts`, example and PBT-M0-03 |
| `version` semver | same |
| Paths relative and inside the root | PBT-CRW-04 and the broken-variant tests |
| Required fields non-empty | broken-variant tests (`version`, `displayName`, `description`) |
| Cron has `every` or `cron_expr` | PBT-M0-02 (the reference also says the two are mutually exclusive, so the code requires exactly one) |
| Page has `route` and `label` | broken-variant tests |
| Unknown fields preserved | PBT-M0-01 |

## Deviation from `docs/PLAN.md` section 3

The plan lists a Vite + React UI (`ui/package.json`, `vite.config.ts`,
`src/App.tsx`). The page is plain DOM bundled with esbuild (`ui/src/index.ts`,
`scripts/build.mjs`). The reason is in `.kiro/specs/crew-app/design.md`: the
page's `mount` arguments and the host import map are undocumented, and a
bundle with no imports cannot fail on them. The five host-provided packages
are still marked external in the esbuild config, so adding React later cannot
bundle a second copy.
