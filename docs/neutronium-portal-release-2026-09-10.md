# Neutronium portal release — 10 September 2026

The user explicitly authorized this release with “push these changes.”

## Changes

This release includes the portal navigation, employee intake and application
review, People filtering, dashboard attention, notification links, email
confirmation handling, manager assignment, session actions, and workflow
dependency fixes described in `neutronium-portal-review-local-2026-09-10.md`.
Greetings now use a person's name instead of their email. Clicking outside an
intake dialog preserves the open form and its entries; explicit close/cancel
actions and normal Escape behavior remain available.

## Target and backups

- Target: `https://neutronium.runsit.ca/neutronium/`, VPS `165.22.236.188`.
- Checkout: `/opt/neutronium`; Compose project: `neutronium`.
- Database: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T204318Z.dump`.
- Private files: the database path with `.files.tar.gz` appended.
- Source: `/opt/neutronium-source-20260910T204319Z.tar.gz`.
- Rollback image: `neutronium-app:before-portal-release-20260910T204319Z`.
- VPS build log: `/opt/neutronium/deploy/neutronium/backups/portal-release-build-20260910T204319Z.log`.

The database dump and both compressed archives passed integrity checks.
Rollback requires restoring the matched database, private files, and source;
do not run the old app against post-migration review data.

## Uploaded scope

Only the 27 reviewed Neutronium files were uploaded: changed or new files in
`src/app/neutronium`, `src/lib/neutronium`, and `tests/neutronium`, migration
`008_application_review.sql`, and the local review notes. Unrelated application
changes, shared website configuration, and secrets were excluded. All uploaded
files passed a SHA-256 comparison with their local source.

The exact manifest and hashes are recorded in the VPS backup directory as
`neutronium-portal-release-files.txt` and `neutronium-portal-release-sha256.txt`.
This completed release record was copied separately after verification.

## Validation and rollout

- Passed: 61 unit/database tests, lint, TypeScript, and the local production build.
- Passed before release: targeted browser coverage, including the regression
  verifying outside clicks retain employee intake details and explicit close works.
- Migrations 003, 004, 005, and 007 were detected as installed.
- Migration 008 was applied once in a transaction. Its three new columns,
  three constraints, and two review indexes were verified.
- The VPS production image built successfully. The app was replaced with
  `docker compose up -d --no-deps app` after the migration committed.
- Live image: `sha256:508132717e26ef108ff03dd84415a3ae514095f7f6567bb241627a6d65fe626f`.
- App and database are healthy; scheduler and proxy are running. The inspected
  app startup logs and scheduler checks showed no failures.
- Internal and public configuration checks passed: authentication enabled and
  demo disabled. The legacy profile URL reaches
  `https://neutronium.runsit.ca/neutronium/?view=profile` with HTTP 200.
- All 14 targeted browser scenarios passed against the published UI, including
  outside-click intake preservation, application review/editing, profile menus,
  People filters, authentication, and mobile employee application correction.
  The invalid-confirmation check used a synthetic invalid token.
- Browser log: `/tmp/neutronium-portal-release-browser-live.log`.
- Scheduler and proxy files match production; neither requires replacement.
- Existing runtime password is configured; no credentials were rotated.

Live email inbox delivery and real Microsoft/customer onboarding remain external
validation. Browser fixtures use synthetic accounts and mocked API mutations;
they do not prove live-provider delivery or provisioning.
