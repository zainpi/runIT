# Employee invitation and approval flow — 10 September 2026

## Product behavior

Selecting **Onboard employee** creates a link the administrator can copy and
send. Each link accepts one employee application, expires after seven days,
and can be revoked from **Employee approvals**. The existing manual onboarding
wizard remains available through **Enter details manually**.

The employee creates an account, verifies their email, returns to the invitation,
and submits their name and optional job details. Existing account holders can
sign in. Pending applications appear in the company's **Employee approvals**
view, where authorized owners, administrators, and HR administrators can review
the details and accept or decline with a message.

Pending and declined applications create no employee record, membership, or
provisioning job. Acceptance creates these together in one database transaction,
assigns the fixed Employee role, and starts the existing onboarding workflow.
The admin selects the company email, department, start date, manager, and role
template. Portal access is granted immediately on acceptance; provider actions
retain their existing verification requirements, including a separate manual
Microsoft first-sign-in handover task.

Employees can revisit their original invitation to check the decision, even after
the link expires or is used. Accepted employees receive a link to the correct
company workspace. Declined employees see the review message and need a new
invitation to apply again.

## Implementation and safeguards

- Migration `007_employee_applications.sql` adds tenant-scoped invitation and
  application tables and a nullable authentication return path. Existing email
  confirmation tokens continue to return to the profile page.
- Invitation secrets are random, stored as SHA-256 hashes, and only returned
  when generated. Public lookup returns company context and, for the signed-in
  applicant only, their own application.
- Approval requires an authorized company role. Employee submissions require a
  verified account. Tenant isolation, CSRF protection, MFA requirements, rate
  limits, and audit records apply.
- Organization/application locking and database constraints prevent concurrent
  approvals, duplicate open applications, and duplicate provisioning jobs.
  Failed approvals roll back the employee, workflow, and membership together.
- Authentication redirects accept only the invitation path and valid token
  format. Arbitrary external return URLs are rejected.

## Validation

The full backend suite passed 56 tests before the final first-sign-in safeguard.
The affected application/provider suites then passed all 16 tests, including
tenant isolation, verified identity, failed-approval rollback, acceptance retry,
decline, expiry, revocation, and preservation of Microsoft handover verification.

Three new Playwright scenarios passed locally: link creation and copy fallback,
employee signup/submission and admin acceptance, decline without completing
unneeded onboarding fields, and revisiting a used link. These browser scenarios
mock account and provider APIs; database behavior is exercised separately with
the SQL migrations and application service functions in PGlite. No real email
or Microsoft provisioning action is triggered by these tests.

All ten existing browser scenarios also passed across completed runs. Some
initial local runs timed out during development compilation and slow API
responses; reruns after stopping the competing local release build passed,
including the full manual onboarding → access request → offboarding workflow,
tester-account management, mobile navigation, and employee help.

## Rollout record

The production image built successfully, and migration 007 was applied once.
The app was replaced with `docker compose up -d --no-deps app`; the app and
database are healthy, and the proxy and scheduler remain running. TypeScript
and Neutronium lint checks passed on the exact uploaded source in an isolated
build-stage container with networking disabled. Local lint and TypeScript had
also passed earlier; the final local full build was stopped during repeated
type checking to relieve resource pressure, and the VPS production build was
used for final packaging verification.

Target: `https://neutronium.runsit.ca/neutronium/` on `165.22.236.188`.
Release image: `sha256:ef50c8a09a3600c96f3f5f1b673358f6388891b37fff3bd4a3d3a4577fb0dbd8`.
The backup dump and compressed archives passed integrity checks before upload:

- Database: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T102945Z.dump`
- Private files: the same dump path with `.files.tar.gz` appended
- Source: `/opt/neutronium-source-20260910T102946Z.tar.gz`
- Previous image: `neutronium-app:before-employee-invitations-20260910T102946Z`

Only Neutronium source, its new migration and tests, and the deployment runbook
are included in this release. Unrelated website/HeaterDeals edits and local
build configuration are excluded from the VPS upload. The rollout procedure
and migration guard are documented in the repository's `AGENTS.md`.

Build and validation logs are retained under
`/opt/neutronium/deploy/neutronium/backups/` as
`employee-invitations-build-20260910.log` and
`employee-invitations-type-lint-20260910.log`.

Post-rollout checks passed:

- The workspace, invitation page, and legacy profile URL return HTTP 200;
  the profile URL canonicalizes to `/neutronium/?view=profile`.
- Public configuration reports authentication configured and demo disabled.
- A synthetic invalid invitation returns a helpful 404. Signed-out requests to
  list applications, create a link, and submit an application return 401.
- Runtime database privileges for the new tables and resolver are present.
- Seven browser scenarios against the published UI passed: four authentication
  and QR-code scenarios and three invitation/approval scenarios. Account and
  review mutations are mocked, so these do not send real email or change real
  employee memberships. Live email delivery and Microsoft actions remain for
  the administrator's normal invited-employee workflow.
- App startup and scheduler logs contain no new errors.

Local browser logs: `/tmp/neutronium-invitations-live-browser.log` (published
UI), `/tmp/neutronium-legacy-retry.log` and
`/tmp/neutronium-legacy-final.log` (existing workflows). Temporary local logs
and screenshots are verification artifacts, not production data backups.
