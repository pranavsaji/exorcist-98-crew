# Design: m0-foundation

## Approach
M0 adds checks and records around the existing app. It adds no feature.

| Requirement | How |
|-------------|-----|
| REQ-01 foundation | `tests/foundation.test.ts` (layout, no SDK dependency, host packages external, no symlinks, licence, no scanner copy). `scripts/build.mjs` marks the five host-provided packages external. Clean-checkout run: copy the tree without `node_modules`, `npm ci`, build, typecheck, test, compare the bundles. |
| REQ-02 manifest | `docs/MANIFEST_CHECK.md` (field by field, against the fetched reference). `shared/manifest.ts` gains the documented optional fields it lacked. More broken-variant tests. |
| REQ-03 Crew | A manual runbook (below). Not automated and not done on this machine. |
| REQ-04 hook | `.kiro/hooks/validate-app-json.json`, `PostFileSave`, matcher `(^|/)app\.json$`, runs `npx vitest run tests/manifest.test.ts`. Checked by `tests/foundation.test.ts` for trigger, matcher and no side effects. |
| REQ-05 properties | PBT-M0-01 to 03 in `tests/manifest.test.ts`, 200 runs each, using `fast-check`. |
| REQ-06 evidence | `docs/MANIFEST_CHECK.md`, `docs/KNOWN_LIMITATIONS.md` (C-015 to C-017). |

## Decisions
- **Plain DOM stays.** `docs/PLAN.md` says Vite + React. Changing it would be a rewrite whose result cannot be checked until Crew runs (C-002). Recorded as C-015.
- **Unknown manifest keys are tolerated.** The reference says they are preserved, so PBT-M0-01 asserts tolerance, not rejection.
- **Exactly one of `every` / `cron_expr`.** The reference table says they are mutually exclusive and the install rule says "either", so the code requires exactly one.
- **No `setup` block.** Crew builds with `npm install && npm run build`; bundles are committed.
- **`permissions.api` kept** although it may be unnecessary (C-016), because removing it cannot be tested here.
- **Hook does not block.** It is a `PostFileSave` command, so a failure shows output only.

## Runbook for REQ-03 (manual)
1. Install Crew from https://kiro.dev/docs/crew/ (desktop app, or the CLI installer). Run `kirocrew setup`, `kirocrew doctor`, `kirocrew gateway`.
2. Install and run one sample app first. Note how `mount` is called and how the backend gets its port.
3. `curl -X POST http://localhost:5476/api/apps/install -H 'Content-Type: application/json' -d '{"source": "<path to this repo>"}'`, then `POST /api/apps/exorcist-98-crew/enable`.
4. `GET /api/apps/exorcist-98-crew/manifest`. Open the sidebar page. Check the Schedule page for `nightly-patrol`. Disable the app and check that the cron is gone.
5. For C-002 to C-006 and C-016, write what you saw in `docs/KNOWN_LIMITATIONS.md` and fix what is wrong, with a test.
