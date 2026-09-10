# Neutronium authentication and tester-account update — September 10, 2026

## Changes

- Authenticator enrollment shows a locally generated, scannable QR code, with a manual setup key as a fallback. Successful verification removes the enrollment details and displays recovery codes.
- Tester accounts include a password.link shortcut and Paste button. Clipboard failures explain how to paste manually; invalid clipboard content does not replace an existing link. URL fragments are preserved.
- Sign-in, sign-up, organization creation, tester-account forms, and MFA show actionable validation messages. Invalid fields receive focus and accessible error descriptions. Network and non-JSON server failures show readable errors while preserving form entries.
- The proxy accepts both `/neutronium` and `/neutronium/*`. Application redirects use the canonical trailing slash, and email confirmation failures return to the app with an explanation. Signup emails now explain that the password was chosen during signup.

## Validation

- 47 backend/domain/database tests passed.
- All 10 browser scenarios passed across the initial run and corrected reruns. New coverage includes organization validation, failed submissions, signup errors, confirmation redirects, clipboard rejection/success, link persistence, and QR enrollment. A subsequent mobile check verified long errors fit their container.
- Lint and TypeScript checks passed; the local production build succeeded. The final CSS adjustment was checked in the browser and is included in the VPS image build.
- macOS Vision independently decoded the QR from the mobile screenshot and matched its test TOTP URI.
- Four additional browser checks passed against the deployed site: organization errors, signup feedback, a synthetic invalid confirmation link, and QR enrollment display/validation. Account mutations were intercepted with test responses.
- Authentication UI tests use synthetic accounts and mocked responses. No real invitation or confirmation token was consumed, and no actual phone enrollment or email delivery was triggered by these tests.

## Deployment

Target: `root@165.22.236.188`, source `/opt/neutronium`, Compose project `neutronium`.

Backups taken before uploading:

- Database: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T095216Z.dump`
- Private files: `/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T095216Z.dump.files.tar.gz`
- Source: `/opt/neutronium-source-20260910T095217Z.tar.gz`
- Previous image: `neutronium-app:before-auth-experience-20260910T095217Z`

This release requires no schema migration or credential change. Only the Neutronium source, account email copy, dependencies, tests, Caddyfile, and runbook were uploaded; concurrent changes to the company website were excluded. The proxy configuration passed Caddy validation, and the formerly failing public profile URL returns HTTP 200 after preserving its query string through the slash redirect.

VPS build log: `/opt/neutronium/deploy/neutronium/backups/auth-experience-build-20260910.log`.

Rollout succeeded. Active image: `sha256:6dac44965fa533bc1d6d8a2821edffeda2b830cd41be20d84b1d3355bbe73a43`.

- App and database containers are healthy; proxy and scheduler are running.
- Public configuration confirms authentication is configured and demo mode is disabled.
- `/neutronium?view=profile` resolves to `/neutronium/?view=profile` with HTTP 200.
- Synthetic invalid confirmations redirect to a useful page with no token in the destination and `Cache-Control: no-store`.
- Recent app/scheduler logs show successful startup and no worker failures.
- The database dump is readable, both compressed archives pass integrity checks, and the source archive excludes secrets and backup directories. This is an integrity check, not a full restore test.

See [AGENTS.md](../AGENTS.md) for the reusable deployment procedure, including proxy reloads and canonical-URL verification.
