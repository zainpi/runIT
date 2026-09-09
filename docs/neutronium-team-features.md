# Team onboarding and service requests

Apply `deploy/neutronium/migrations/002_social_auth.sql` to existing PostgreSQL installations before deploying this version. New Docker installations apply both migrations automatically. Back up the database first using the existing deployment procedure.

Signup offers Employee (join an invited company) and Admin (create a new company). This selection is onboarding intent, never a grant of access to an existing company. Existing membership and invitation checks remain authoritative. Employees can check their invitation from the waiting screen. Admins invite employees through the existing employee profile workflow.

Employee help is a shared admin inbox with employee/subject/text search and status filtering. Employees see only their own conversations. Admins can reply, attach a file up to 50 KB, and mark a request waiting or resolved. Replies reopen requests for review. Attachments are stored with the private workspace, downloaded as binary files, and never rendered as HTML. There is a 100-message conversation limit. HR and platform support roles do not receive company help conversations. Existing access approvals remain separate, with their multi-stage authorization checks.

People → Export employee CSV exports work identity, department, title, location, status and start date. It requires owner/admin/HR permission, records an audit event, and escapes spreadsheet formulas. It excludes personal email and credentials. Microsoft inventory import remains available in Integrations.

## Social sign-in

Set the five social sign-in values in `.env.neutronium.example`. Register exact redirect URIs (without a trailing slash):

- `https://YOUR_HOST/neutronium/api/auth/social/google/callback`
- `https://YOUR_HOST/neutronium/api/auth/social/microsoft/callback`

Use separate sign-in registrations with `openid email profile` scopes. Google sign-in also accepts Gmail accounts; it does not read mail. Microsoft sign-in currently uses one configured tenant. Directory administration consent is a separate connection.

The server verifies signed ID tokens, issuer, audience, expiry and nonce, and uses PKCE plus a one-use browser-bound state. Identity mappings use provider issuer and subject. Existing accounts must authenticate with their password/invitation first, then explicitly link the matching provider from Profile or the invitation waiting screen. Provider email alone never takes over an existing account. New Microsoft accounts confirm email through the configured email service before gaining a session. Retry provider sign-in to resend an undelivered confirmation.

## Read-only integrations

Admins can connect Vercel projects, Jira Cloud issues and GitHub repository issues from Integrations using API tokens. Credentials are encrypted with the existing tenant-bound encryption key and never sent back to the browser. The connection is tested before saving. Each sync displays up to 100 records; it is an on-demand snapshot, not a complete enterprise export. Jira supports standard API tokens with an Atlassian email and `company.atlassian.net` hostname. GitHub needs repository Issues read permission. Choose the narrowest provider token scope available. Integration sync does not grant employee access or create external tickets.

## Account risk

Account risk reads Microsoft Entra Identity Protection risky users with `IdentityRiskyUser.Read.All` application consent. Configure that permission on the directory integration registration, obtain admin consent, and enable the Account risk detection feature. Check your tenant's applicable Identity Protection licensing. The UI shows risk level, state, detail and last successful check; checks are manual in this version. Failed checks preserve the previous timestamp and records. Risk signals require investigation and never trigger automatic suspension. There is no local impossible-travel or credential-stuffing detector in this version.

Provider references: [Microsoft risky users](https://learn.microsoft.com/en-us/graph/api/riskyuser-list?view=graph-rest-1.0), [Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Vercel API](https://vercel.com/docs/rest-api), [Jira search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/), [GitHub issues](https://docs.github.com/en/rest/issues/issues).

## Testing without a live tenant

1. Open the development workspace. In People, choose Create test employee.
2. Select the new employee in the development persona menu. Open Employee help and submit a plain-text request.
3. Switch to Admin. Open Employee help, select the request, attach a small text file and respond. Switch back to the employee to download it.
4. Switch to another employee and confirm the first employee's request is absent.
5. Switch to Admin, open Account risk and choose Simulate compromised account. The record is explicitly simulated; no external account is touched.
6. Export the employee CSV from People.

Run `npm run test:neutronium`, `npm run lint`, `npx tsc --noEmit`. For browser tests start `npm run dev -- --port 3010`, then `npm run test:neutronium:browser`.

Live OAuth consent, actual API tokens, email delivery and licensed risk signals need validation in a separate test company with configured provider credentials. Never use development personas as production identities.

## Test environments and tester accounts

Company owners/admins now have a **Test environments** area. Add named staging, production, or development environments with HTTPS URLs and instructions. Register associated application accounts using their username/email, label, application role, assigned employee, notes, and an optional HTTPS password-manager link. This directory does not create accounts in external applications or store their passwords.

Search by environment, username, role or assigned tester; filter by environment type. Edit account details and archive/restore both environments and accounts. Archiving an environment retains its associated accounts and prevents account changes until restored. Archiving a directory record does not revoke external access. Duplicate usernames are rejected within the same environment; the same username can belong to separate environments. Directory data is company-scoped and excluded from employee, HR and platform projections. Changes are audited without copying credential links into audit events.

This uses existing workspace metadata storage and requires no additional migration. To test, create a staging URL, add an account assigned to Sarah, archive and restore it, reload, and switch to an employee persona to verify that the directory is hidden.
