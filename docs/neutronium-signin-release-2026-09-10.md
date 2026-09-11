# Sign-in fix release — 10 September 2026

The user explicitly authorized this release after requesting local work by
default. Future changes still require a separate explicit push request.

## Change

Authenticated users without a company workspace were stuck on setup without a
way to return to login. Both the employee and administrator setup screens now
show the signed-in email and **Sign in with a different account**. The button
ends the session before displaying the login form. If the request fails, the
screen preserves its state and shows the error. The employee screen no longer
shows a disabled Create workspace button.

## Scope and validation

Only `src/app/neutronium/workspace.tsx`, the associated authentication browser
tests, and `AGENTS.md` were uploaded. Unrelated local work was excluded. No
database migration, credential, permission, proxy, or scheduler change is
needed for this release.

Before rollout, all 56 backend tests and all five authentication browser
scenarios passed. Neutronium lint and TypeScript checks passed. The two affected
browser tests passed again after the final wording change and administrator
account-switch assertion. The tests cover returning to login from both setup
screens, preserving the screen on failed logout, and avoiding accidental
workspace creation when switching accounts.

## Deployment record

Target: `https://neutronium.runsit.ca/neutronium/`, VPS `165.22.236.188`.

- Database: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T111538Z.dump`
- Private files: the same dump path with `.files.tar.gz` appended
- Source: `/opt/neutronium-source-20260910T111540Z.tar.gz`
- Rollback image: `neutronium-app:before-signin-release-20260910T111540Z`
- Build log: `/opt/neutronium/deploy/neutronium/backups/signin-release-build-20260910T111540Z.log`

The dump and compressed backup archives passed integrity checks. The production
build succeeded, and the app was replaced using
`docker compose up -d --no-deps app`.

Live image:
`sha256:7cbefeab1b50b497a624afdcf6e8dd45dcdc830b82394ae6335347572b95fb25`.

Post-rollout verification passed:

- App and database healthy; proxy and scheduler running, with no new errors in
  the inspected startup/scheduler logs.
- Public configuration reports authentication enabled and demo disabled.
- The legacy profile URL redirects to `/neutronium/?view=profile` and returns
  HTTP 200.
- All five authentication browser scenarios passed against the published UI.
  Account mutations in these tests are mocked; no real user was logged out and
  no real email was sent.
- The new account-switch button and signed-in account label were also verified
  in the user's existing browser session. The page was left open for the user
  to test; the real account-switch button was not clicked by the agent.

Browser test log: `/tmp/neutronium-signin-release-live.log`.
