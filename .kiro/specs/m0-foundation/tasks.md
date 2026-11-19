# Tasks: m0-foundation
- [x] TASK-01 Hook `validate-app-json` created and checked. (REQ-04)
- [x] TASK-02 Manifest schema: documented optional fields added. (REQ-02.4)
- [x] TASK-03 Broken-variant tests for every case in REQ-02.5. (REQ-02.5)
- [x] TASK-04 PBT-M0-01 to 03 with fast-check. (REQ-05)
- [x] TASK-05 `tests/foundation.test.ts` and external packages in the build. (REQ-01)
- [x] TASK-06 `docs/MANIFEST_CHECK.md`; new limitations C-015 to C-017. (REQ-02.1-3, REQ-02.6, REQ-06.1)
- [x] TASK-07 Clean-checkout run: `npm ci`, build, typecheck, test; bundles identical. (REQ-01.4)
- [~] TASK-08 Install Crew, install and enable this app, record C-002 to C-006 and C-016. (REQ-03) **Mostly done.** Crew 0.12.2 installed; app installed, enabled, updated and disabled; agent, skill and cron registered; page checked in a signed-in Chrome (add folder, patrol, results); proxy, port and header checked. **Not done:** no Crew sample app was run (REQ-03.2); the Sentry agent in chat and the cron firing need a Kiro sign-in. See `docs/KNOWN_LIMITATIONS.md`.
- [ ] TASK-09 Tick the Nov 18 line in `docs/PLAN.md`. (REQ-06.2) **Not ticked: TASK-08 is partial.**
## Results
- 83 tests in 7 files pass (was 59 in 6): 12 more broken-variant cases, three properties, 9 foundation checks.
- A clean copy passes build and typecheck, and its bundles are identical to the committed ones. In the clean copy 1 test is skipped (the real-CLI scan; the Haunted Repo is not in that copy).
- M0 is **still incomplete**: REQ-03 is partly done (see TASK-08).
- Installing in Crew found four defects the unit tests could not: missing `permissions.cron`, the wrong proxy header name, a signed `/health`, and an untrusted-app block (N-001 to N-004).
