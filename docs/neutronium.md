# Neutronium

A dedicated company IT administration application at `/neutronium/` in the existing Next.js website. It has its own light dashboard shell; the marketing navigation, footer, and ad script do not render inside the application. Existing website routes remain intact.

## Run the complete local demo

```sh
npm install
npm run dev -- --port 3010
# In a second terminal, keep workflows running when the browser is closed:
npm run neutronium:worker
```

Open `http://localhost:3010/neutronium/`. In Next.js development mode, a fresh, cookie-isolated Acme Inc. workspace is created automatically. Data is persisted under the gitignored `.neutronium-dev/` directory, with restricted filesystem permissions and atomic, locked updates. Development mode is deliberately unavailable in production and can also be disabled with `NEUTRONIUM_DISABLE_DEMO=true`. It never changes real provider accounts.

1. Create or edit a Developer role template. Microsoft 365 and GitHub use the development adapter; Slack and Notion are manual.
2. Onboard an employee, assign Michael Ross as manager, and select Developer.
3. Open Workflows and watch identity, application, and invitation steps finish.
4. Use **Preview as** to open the new employee's portal.
5. Request GitHub Admin for 4 hours, or 1 minute to test expiry.
6. Switch to **Michael Ross · Manager**, open Access requests, and approve.
7. Return to the employee's My access page. Admin access has an expiration; existing Standard access remains independent.
8. The worker revokes temporary access when due. Manual providers generate a removal step requiring administrator evidence.
9. Switch to Company admin, offboard the employee, type their company email, and follow the workflow.
10. Inspect the audit log or export its JSON.

The browser also nudges the local worker every 1.4 seconds for convenient demos. The standalone worker is the mechanism for unattended execution with the browser closed. Production always uses the authenticated scheduler.

## Architecture and data model

- `src/lib/neutronium/model.ts`: typed entities, seed, role policy, approver resolution, response projection.
- `service.ts`: bounded command handlers. Every employee/resource lookup is within the authenticated organization. Commands validate role, target, input and state before mutation.
- `store.ts`: local development adapter and production PostgreSQL repository. Production mutations use a Postgres row lock and revision compare-and-swap RPC, so a losing concurrent command retries against current state.
- `providers.ts`: identity, email, application, HR, device, and calendar contracts; Microsoft Graph implementation; explicitly labeled development adapter; authenticated encryption.
- `worker.ts`: durable jobs, step leases, retry backoff, expired-grant scheduling, in-app notifications, optional Resend email outbox.
- `/neutronium/api/[...path]`: authentication, organizations, commands, Microsoft consent, inventory sync, invitations, scheduler.
- `deploy/neutronium/migrations/001_initial.sql`: isolated `neutronium_*` namespace. No changes to existing application tables.

The relational database stores organizations, user memberships, operator memberships/scopes, employees, applications, templates, employee access grants, requests, jobs, audit events, notifications, integrations, encrypted credentials, OAuth nonces, and rate-limit windows. Each tenant entity has a composite `(organization_id, id)` primary key. Employee email uniqueness and cross-tenant foreign keys are enforced in PostgreSQL. Generated employee/application/manager/template columns support relational constraints and indexes. Lifecycle enums are checked at the database boundary. Employees and templates are deactivated instead of deleted.

Variable provider configuration is JSONB. Steps are embedded in their job aggregate, and approvals are embedded in their request aggregate; this keeps state transitions atomic in the MVP. They are individually identified, leased, status-tracked, and auditable. This design loads one organization's aggregate and is suitable for small companies, not an unbounded enterprise directory. Split large aggregates and paginate data before increasing the limits.

Audit events are append-only at the database level. They include actor, organization (relational key), target, integration, timestamp, result, request identifier, and relevant previous/new state. Passwords and tokens never enter audit payloads. Operator workspace inspections and support-note writes are logged. IP addresses are not persisted in audit records; trusted edge IPs are used only in hashed rate-limit keys.

## Authorization

| Role | Capability |
| --- | --- |
| ORG_OWNER / ORG_ADMIN | Company administration, templates, employee workflows, integration configuration; approve only when assigned to the current approval stage |
| HR_ADMIN | Directory, templates, onboarding, offboarding, retries; cannot change integration credentials or approve by virtue of HR role |
| MANAGER | Own portal and requests assigned through employee manager relationships |
| APPROVER | Own portal and requests assigned through application ownership |
| EMPLOYEE | Own applications, grants, requests, and notifications |
| PLATFORM_OWNER | All customer operational summaries, audit visibility, support notes; cannot provision identities or approve customer access |
| PLATFORM_SUPPORT | Operational visibility and support notes for explicitly assigned customers |
| PLATFORM_SECURITY / PLATFORM_READONLY | Read-only operational visibility for explicitly assigned customers |

Approvals may require manager, application owner, administrator, or a sequence. Self-approval is forbidden. The request stores a policy snapshot; changing the company policy does not rewrite an existing approval chain. An approver can approve, reject, or request information; the requester can reply. All requested stages must approve before a grant job exists.

PostgreSQL is private to the VPS Docker network. The application connects as the dedicated database owner; public table/function privileges are revoked and RLS is enabled. Browser access is exclusively through authenticated server projections. Employees cannot fetch other employees' private fields, integration records, templates, or support notes. Demo personas are server-signed and isolated to one development workspace; the demo directory intentionally shows sample employee names to make switching personas possible.

Production employee sessions are denied when offboarding becomes due, independent of whether Microsoft is temporarily unavailable. Operators need explicit assignments in `neutronium_platform_scopes`, except the platform owner. Provision operator roles/scopes using trusted database administration, never browser self-service.

## Production setup

Neutronium runs on a VPS with Docker Compose: Node.js, PostgreSQL 17, Caddy HTTPS, and a persistent scheduler. It does not require Supabase. Other applications in this repository retain their own Supabase integration.

See [VPS deployment](../deploy/neutronium/README.md) for installation, backups, updates and migration notes. Copy `.env.neutronium.example` to `deploy/neutronium/.env`, supply a domain, database password, scheduler secret, encryption keyring and email credentials. Set `NEUTRONIUM_APP_URL` to the HTTPS origin. All secrets stay server-side.

Authentication uses salted scrypt password hashes and random 256-bit session tokens stored only as SHA-256 hashes in PostgreSQL. Cookies are HttpOnly, Secure in production, SameSite=Lax, scoped to `/neutronium`, and expire after eight hours. Email confirmation and invitation links are single-use, expire after 24 hours, and are delivered through the existing Resend configuration. Password changes revoke all previous sessions and authentication links. Configure email delivery before enabling signup/invitations. Existing verified users can sign in normally after an administrator assigns their membership.

Generate an encryption key with `openssl rand -base64 32`; use separate random values for the database password and scheduler secret. Keep previous encryption keys when rotating so existing credentials remain readable.

### Microsoft registration

Register a confidential, multi-tenant Entra application. Set its web redirect URI to the exact consent redirect used by the application:

```text
https://your-domain.example/neutronium/api/microsoft/callback
```

Configure only the application permissions your deployment actually supports:

| Feature | Microsoft application permissions |
| --- | --- |
| Inventory | `User.Read.All` |
| Create identities | `User.Create`, `User.Read.All` |
| Group-based application access | `GroupMember.ReadWrite.All` |
| Assign licenses | `LicenseAssignment.ReadWrite.All` |
| Disable sign-in / revoke sessions | `User.EnableDisableAccount.All`, `User.Read.All`, `User.RevokeSessions.All` |

The integration UI explains each feature and permission. OAuth state is a single-use, hashed nonce bound to authenticated user, organization, tenant, feature selection, and a ten-minute deadline. Callback processing compares the consent tenant and verifies granted application roles using a token obtained directly from Microsoft's HTTPS endpoint. Tokens are encrypted with AES-256-GCM, authenticated to the organization ID, and never returned to the browser.

Microsoft application permissions use `.default` admin consent, which covers the application's configured permissions. Feature selection gates execution but cannot force Microsoft's application-permission consent dialog to request an arbitrary dynamic subset. Use separate narrowly scoped app registrations in a later capability-bundle expansion if tenant-specific consent boundaries require this. No `Directory.ReadWrite.All` or directory administrator role assignment is requested.

Account creation uses a stable 16-character hashed workflow marker in Microsoft `employeeId`, respecting the [Microsoft user field limit](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0). If an email already exists without that marker, provisioning pauses rather than adopting or overwriting it. Import + sync explicitly matches existing accounts by company email. Microsoft groups are configured by object ID. Pre-existing untracked memberships are not automatically claimed/revoked: those operations pause for manual review. License assignment requires a valid SKU, available capacity, and the user's Microsoft `usageLocation` configured by an administrator. Initial account passwords are random and not retained; an administrator must arrange secure first sign-in and verify the invitation step.

Identity creation is not a claim that a mailbox exists. Mail provisioning depends on your tenant's email architecture and chosen license. Preservation, transfer of mailbox/data ownership, unmanaged directory groups/roles, and device access are explicit manual review steps. No external data is deleted by Neutronium.

References used for the adapter: [Create user](https://learn.microsoft.com/en-us/graph/api/user-post-users?view=graph-rest-1.0), [Update user](https://learn.microsoft.com/en-us/graph/api/user-update?view=graph-rest-1.0), [Revoke sessions](https://learn.microsoft.com/en-us/graph/api/user-revokesigninsessions?view=graph-rest-1.0), [Group membership](https://learn.microsoft.com/en-us/graph/api/group-post-members?view=graph-rest-1.0), [Admin consent](https://learn.microsoft.com/en-us/entra/identity-platform/v2-admin-consent).

### Scheduler and reliability

The VPS scheduler invokes Neutronium once per minute and retries after failures. Keep the Neutronium scheduler secret only on the VPS. The website’s existing Cloudflare deployment is separate. Other hosts can schedule:

```sh
curl -X POST https://your-domain.example/neutronium/api/worker/ \
  -H "Authorization: Bearer $NEUTRONIUM_CRON_SECRET"
```

Jobs store steps before execution. Workers claim one step using a random lease, persist the claim, call the provider outside the transaction, and only finalize if still holding the lease. Expired leases can be reclaimed after two minutes. Transient errors retry up to three attempts with backoff. Administrators can retry failed workflows. Unsupported provider operations pause as `manual_required`; only a company administrator can record completion evidence. Existing successful steps do not rerun.

Expiration is eventual, bounded by scheduler cadence plus provider latency/retry time; it is not a guarantee of exact-to-the-second removal. The scheduler marks a grant `revoking`, executes provider removal, and only then marks `revoked`. Manual apps require provider-side verification. Notifications record pending/sent/unconfigured delivery. Email uses a stable idempotency key and exponential retry. For this MVP the scheduler scans at most 500 organizations and processes up to ten steps per organization per call. Larger installations need a dedicated queue and paginated worker dispatch.

No inbound third-party webhook endpoints are exposed. A future webhook integration must implement provider signature verification before accepting events.

## Verification

```sh
npm run test:neutronium
# With the dev server running on 127.0.0.1:3010:
npx playwright install chromium
npm run test:neutronium:browser
npx tsc --noEmit
npm run build
```

The database suite executes the real migration in embedded PostgreSQL (PGlite), including foreign keys, RLS/table access denial, optimistic concurrency and append-only audit checks. Domain tests cover server RBAC, tenant boundaries, approval chains, self-approval prevention, request clarification, lease recovery, scheduling, idempotent development provisioning, manual integration behavior and temporary grants. Browser tests cover the full demo flow, API authorization failures, mobile overflow, and dialog keyboard dismissal. Live Microsoft and production email delivery remain external integration validation work.

## Deliberate scope limits

There is no billing processor; subscription status is stored information. No automatic threat detection is claimed: elevated or expiring access is shown as a review item. Manual application inventory is not a discovered provider-wide permission audit. Groups/resources beyond configured Microsoft security groups, SharePoint-specific permissions, HR/device/calendar connectors, Google Workspace, social account creation, and automated mailbox/data migration are extension points, not connected integrations. There are no fake charts, placeholder successful provider responses, or automatic operator access to customer identity administration.
