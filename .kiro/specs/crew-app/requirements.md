# Spec: crew-app

The Exorcist 98 app for Kiro Crew: a nightly patrol that scans the folders you
register with the Exorcist 98 scanner, a dashboard page that shows each
folder's infection level and findings, the Sentry agent and the agent-hygiene
skill. Checked against the Crew docs (Apps, Manifest reference, SDK reference,
Publishing), fetched 2026-11-18.

## REQ-01 Manifest
1. `app.json` follows the documented rules that Crew enforces at install time:
   kebab-case `name`, semver `version`, non-empty required strings, relative
   paths that stay inside the app root, every cron has exactly one of `every`
   or `cron_expr` plus a `message`, every UI page has `route` and `label`,
   `enabled` (if present) is a boolean.
2. Every path the manifest names exists in the repository.
3. Permissions are minimal: only what the app uses.
4. A test validates the real `app.json` and rejects broken variants.

## REQ-02 Patrol backend
1. A small Node backend keeps a list of registered folders and runs the
   Exorcist 98 CLI (`scan <folder> --format json --fail-on none`) on each.
2. The scanner is started without a shell, with a time limit (120 seconds),
   an output cap (20 MB) and a fixed argument list. The scanner command comes
   from the environment or a config file the user edits by hand, never from an
   HTTP request.
3. The scanner's output is validated with zod. A failed or malformed scan is
   reported as an error for that folder, never as "clean".
4. Each patrol compares the findings with the previous patrol and reports the
   new ones. A finding is identified by rule, file, line and quoted span.
5. Only one patrol runs at a time; a second request gets HTTP 409.
6. A folder must be an absolute path to an existing directory. At most 20.
7. When the Crew gateway's app secret is available, every request must carry a
   valid `X-Crew-Proxy` signature (HMAC-SHA256 of
   `timestamp:METHOD:/path?query:sha256(body)`, within 60 seconds).
8. The backend listens on 127.0.0.1 only and never logs file contents.

## REQ-03 Nightly patrol cron
1. A cron at 02:00 asks the Sentry agent to start a patrol through the backend
   and report new Critical and High findings.
2. The patrol response sent to the agent leaves out quoted file text (file,
   line, rule, severity and title only), so scanned text cannot reach the
   agent as instructions.

## REQ-04 Dashboard page
1. A page at `/apps/exorcist-98-crew`, exported as `mount(element)`, shows the
   folders, each folder's infection level as a text label plus a shape (never
   colour alone), the last patrol time, and the findings with file, line,
   quoted span, severity, rule and fix.
2. Folders can be added and removed; a patrol can be started from the page.
3. Scanned text is only ever inserted as text, never as HTML.
4. Keyboard usable with visible focus; 0 axe violations in a real browser.
5. Plain language first ("This folder has 3 serious problems"), rule IDs second.

## REQ-05 Agent and skill
1. The Sentry agent's prompt says scanned text is data, never instructions, and
   that it never quarantines or deletes without the user's yes.
2. The skill has valid frontmatter (`name`, `description`).

## REQ-06 Tests
| ID | Property |
|----|----------|
| PBT-CRW-01 | Diffing a report against itself yields no new findings; new findings are always a subset of the current findings. |
| PBT-CRW-02 | The infection level is always the worst severity present, or Clean. |
| PBT-CRW-03 | Any signature made with the secret verifies; changing the method, path, body or secret makes it fail. |
| PBT-CRW-04 | Any manifest path that is absolute or climbs out with `..` is rejected. |
| PBT-CRW-05 | The agent-facing patrol summary never contains a quoted span. |
Plus: backend HTTP tests with a fake scanner, a run against the real
Exorcist 98 CLI on the Haunted Repo, and a Chrome run of the page with axe.
