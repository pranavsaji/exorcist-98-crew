# Requirements: m0-foundation

Milestone M0 of `docs/PLAN.md` section 5: **"Nov 18: install Crew, run the sample app, confirm the manifest fields."**

Stack and layout follow `docs/PLAN.md` section 3 (Crew app, Vite + React UI, small Node backend, `app.json` at the repo root) and `.kiro/steering/product.md`.

## Assumptions (please confirm)

- A1. `docs/PLAN.md` has no "M0". M0 is taken to be the first milestone, the Nov 18 line. M1 to M5 would then be the remaining four dated lines, with M5 unnamed.
- A2. The plan does not mention property-based tests. Property tests with fast-check are included because you asked for them and `fast-check` is already a dev dependency. M0 reuses PBT-CRW-04 from the existing `crew-app` spec and adds two more manifest properties.
- A3. The plan lists one hook: "on change to `app.json`, validate it against the manifest rules". That is the only hook created for M0 (`.kiro/hooks/validate-app-json.json`, already written; it takes effect at the next session start).
- A4. Much of the app already exists (see the `crew-app` spec, all tasks ticked). M0 therefore does not rebuild anything. It verifies the foundation and closes the gaps in `docs/KNOWN_LIMITATIONS.md` (C-001 to C-006) that belong to "install Crew and confirm the manifest fields".
- A5. Crew is not installed on this machine, so M0 steps that need Crew are manual checks. Their results are recorded as evidence and are never assumed.

## Out of scope

Sentry agent behaviour in chat (M1), the cron calling the CLI and notifications (M2), dashboard work (M3), README screenshots and the video clip (M4), the MCP rug-pull watch (C-009), and anything that quarantines or deletes (steering: needs explicit user confirmation).

## REQ-01 Repo foundation

1. The repo layout matches `docs/PLAN.md` section 3: `app.json` at the root, `agents/exorcist-sentry.json`, `skills/agent-hygiene/SKILL.md`, `ui/`, `backend/`, `.kiro/steering/product.md`, `docs/PLAN.md` and `README.md`.
2. The repo is separate from the main `exorcist-98` repo. It holds no copy of the scanner, shield or web app code.
3. `@kirocrew/app-sdk` is not listed in any `package.json`. The UI build marks `react`, `react-dom`, `react/jsx-runtime`, `lucide-react` and `@kirocrew/app-sdk` as externals.
4. `npm install`, `npm run build`, `npm test` and `npm run typecheck` pass on Node 20 or newer from a clean checkout.
5. The license is Apache-2.0 and the `LICENSE` file is present.

## REQ-02 Manifest fields confirmed against the official reference

1. Each field in `app.json` (`name`, `version`, `displayName`, `description`, `author`, `license`, `tags`, `highlights`, `agents`, `skills`, `backend`, `ui`, `permissions`, `crons`) is checked against the current Crew Manifest reference. The result for each field is recorded in `docs/MANIFEST_CHECK.md` with the reference URL and the date fetched.
2. The plan says `app.json` is "a starting draft". After REQ-02.1, any field that is wrong, undocumented or unused is corrected or removed, and the reason is recorded.
3. `setup` (`onInstall`, `onUpdate`) is either added with a stated purpose or recorded as deliberately omitted.
4. `shared/manifest.ts` encodes every rule Crew enforces at install time that the reference documents. Where the reference is silent, the code does not invent a rule.
5. `validateManifest` returns an empty list for the real `app.json`, and a non-empty list naming the field for each broken variant below:
   - `name` not in kebab-case
   - `version` not semver
   - an empty required string
   - an absolute path or a path with `..` in `agents`, `skills`, `backend.entryPoint` or `ui.entry`
   - a path that does not exist
   - a cron with both or neither of `every` and `cron_expr`
   - a cron without `message`
   - a page without `route` or `label`
   - a non-boolean `enabled`
6. Permissions in `app.json` list only what the app uses (`/apps/exorcist-98-crew/api`).

## REQ-03 Install and run in a real Crew

1. Crew (`kirocrew`) is installed, `kirocrew gateway` runs and `kirocrew doctor` is clean, or each failure is recorded.
2. A Crew sample app is installed and run first, to see how a working app behaves. What it shows for C-002 to C-005 is recorded.
3. `exorcist-98-crew` is installed through the REST API on `localhost:5476` or "Install from local path", then enabled.
4. After install, the page route, the backend health check, the agent and the skill are each shown as registered. The `nightly-patrol` cron appears when the app is enabled and disappears when it is disabled.
5. Each of C-002 (`mount` signature), C-003 (how the backend learns its port), C-004 (`X-Crew-Proxy` details), C-005 (path prefix) and C-006 (`ui.entry` location) is marked *Verified* or *Wrong* in `docs/KNOWN_LIMITATIONS.md`, with the observation behind it. Wrong assumptions are fixed in code, with a test.
6. If Crew cannot be installed, M0 is reported as incomplete. The app is not described as "run inside Crew" anywhere (the README status section keeps saying so).

## REQ-04 Manifest hook

1. Saving `app.json` runs `npx vitest run tests/manifest.test.ts` through the hook `validate-app-json` (trigger `PostFileSave`, matcher `(^|/)app\.json$`).
2. The hook only reads and runs tests. It does not edit files, send anything over the network, or quarantine or delete anything.
3. A failing validation shows its output to the user. It does not block the save.
4. The hook is committed under `.kiro/hooks/`.

## REQ-05 Property-based tests (fast-check)

| ID | Property |
|----|----------|
| PBT-CRW-04 (existing) | Any manifest path that is absolute or climbs out of the app root with `..` is rejected. |
| PBT-M0-01 | A valid manifest stays valid after its key order changes and after unknown top-level keys are added or removed. This applies only if the reference says unknown keys are tolerated. Otherwise the property is that unknown keys are rejected. |
| PBT-M0-02 | For any manifest with a cron that has both or neither of `every` and `cron_expr`, validation fails. A cron with exactly one validates. |
| PBT-M0-03 | For any string that is not kebab-case or any version that is not semver, validation fails. Every kebab-case name and every semver version validates. |

1. Each property runs at least 100 cases and uses the generators in `tests/arb.ts`.
2. A failing case is reproducible from the seed that fast-check prints.
3. Example-based tests cover the broken variants in REQ-02.5. Properties cover the input space around them.

## REQ-06 Evidence and honesty

1. `docs/MANIFEST_CHECK.md` and `docs/KNOWN_LIMITATIONS.md` are the record of what was and was not verified in Crew.
2. The plan's Nov 18 milestone line is ticked only when REQ-02 and REQ-03 are met.
3. Work for this milestone is logged in the main repo's `docs/KIRO_LOG.md`, as the plan requires. That file lives in another repo, so the log entry is handed to the user to paste and is not written from here.
4. No M0 change makes a network call, other than fetching the Crew docs and talking to the local gateway.

## Questions for review

- Q1. Is M0 the Nov 18 line (A1)? If you have a different M0 to M5 list, send it.
- Q2. Is the manifest hook the only M0 hook you meant (A3)?
- Q3. Do you want REQ-03 included even though Crew is not installed here (A5)? If not, M0 would shrink to REQ-01, REQ-02, REQ-04 and REQ-05.
- Q4. Should `docs/MANIFEST_CHECK.md` be a new file, or should the results go into the `crew-app` spec?
