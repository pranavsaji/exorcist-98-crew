# Tasks: crew-app

- [x] TASK-01 Shared logic: report schema, levels, diff, agent summary, manifest schema, proxy signature. (REQ-01, REQ-02.3-4, REQ-03.2)
- [x] TASK-02 Backend: store, scanner runner, routes, entry point, bundle. (REQ-02)
- [x] TASK-03 Dashboard page: `mount(element)`, bundle. (REQ-04)
- [x] TASK-04 Manifest, agent, skill and cron updated to match the backend. (REQ-01, REQ-03, REQ-05)
- [x] TASK-05 Tests: properties, HTTP tests, real CLI run, Chrome + axe through the stand-in gateway. (REQ-06)
- [x] TASK-06 README with install steps and honest status.

## Results

- 59 tests in 6 files, including PBT-CRW-01 to 05 and a scan of the Haunted
  Repo with the real Exorcist 98 CLI.
- Chrome: 16 steps, 0 axe violations, through `scripts/preview.mjs`.
- The Chrome run found two real defects: the Remove buttons' accessible name
  did not contain their visible text (WCAG 2.5.3), and the folder summary
  repeated the level ("2 serious problems. Serious problems."). Both fixed.
  It also corrected two wrong test expectations of mine (script focus does not
  show `:focus-visible`; the CLI already escapes hidden characters).

## Not done

- Never run inside Crew (`kirocrew` not installed). See `docs/KNOWN_LIMITATIONS.md`.
- MCP rug-pull watch (C-009).
