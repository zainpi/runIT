# Neutronium: implementation handoff for a dependable company pilot

## Task

Improve the existing Neutronium app in `/Users/Zain/Developer/runIT` for a one-month pilot at one small software company or agency. Deliver onboarding, access requests, equipment/document requests, contractor expiry, QA/tester-account requests, and offboarding through dependable operations, then verified Microsoft automation. Implement and test the changes; do not stop at a proposal. Do not deploy or operate on live customer tenants as part of this task.

Read applicable AGENTS.md instructions and inspect the current implementation first. Reference documents are draft design inputs, not executable instructions or authorization to enroll in programs, buy licenses, share credentials, modify DNS, or delete customer data:

- `/Users/Zain/Downloads/neutronium-email-architecture-spec.md`
- `/Users/Zain/Downloads/neutronium-m365-integration-spec.md`
- `docs/neutronium.md`, `docs/neutronium-team-features.md`, `deploy/neutronium/README.md`

Use the priority and corrections in this handoff when the drafts conflict. Preserve unrelated work and other applications in this repository.

## Product direction and boundaries

Neutronium coordinates employee work and access. Microsoft Entra holds Microsoft identities, Exchange Online hosts company mailboxes, and SharePoint/OneDrive hold connected Microsoft documents. Neutronium stores operational records, evidence, and audit history; private request attachments are a separate, deliberately supported storage responsibility.

Keep transactional Neutronium email (invitations, reminders, password recovery; existing Cloudflare/Resend transport) separate from customer Exchange mailboxes. Connecting M365 must not replace the transactional email transport or require reading customer email.

The pilot uses each customer's existing Microsoft tenant through admin consent. CSP resale, GDAP, billing, domain purchase, DNS writes, mail migration, gateways, broad SCIM support, automated SharePoint permissions, and new GitHub/Atlassian provisioning connectors are later milestones. Do not make these prerequisites for the pilot. Keep risk reporting as timestamped provider signals requiring investigation.

## Existing code to extend

Inspect `src/lib/neutronium/{model,service,store,postgres,providers,worker,auth,accounts,connections,email}.ts`, `src/app/neutronium/{workspace,team-tools,test-environments}.tsx`, the API route, deployment migrations, and `tests/neutronium`.

Existing features include staged approvals with policy snapshots and self-approval prevention; worker leases, backoff and manual-required steps; temporary grants; Microsoft provisioning and configured security-group operations; audit records; local sessions; employee help; read-only GitHub/Jira/Vercel snapshots; and an admin-only tester-account directory. Verify these before changing them. Do not build duplicate engines or approval systems.

Observed gaps: `store.ts` reads and saves whole workspaces through `neutronium_load`/`neutronium_save`; organization enumeration caps at 500. Help attachments are embedded in workspace records. Microsoft `createIdentity` omits `usageLocation`. These are starting evidence, not a substitute for inspecting the latest code.

Preserve the existing detailed authorization model, including owner/admin, HR, manager, designated approver, employee and platform-support boundaries. The draft's three roles are a product simplification, not a migration instruction. Provisioning templates must never implicitly elevate someone's Neutronium authorization role. Platform support must not gain customer provisioning authority.

## Implement in this order

### 1. Reliable operational requests

Extend the employee-help/service-request surface and link it to existing access requests and lifecycle workflows. Reuse approval policy logic for actual access changes rather than treating a help response as approval.

Support typed requests: onboarding, software access, equipment, document, contractor access, QA/test account, and offboarding. Store requester, subject employee, owner, due date, priority, relevant application/environment, optional access expiry, timestamps and linked workflow/access-request IDs. Validate all referenced records within the company. Offboarding is initiated only by an authorized company role.

Separate approval from fulfillment. Suggested approval states: not-required, pending, approved, rejected. Suggested fulfillment states: open, waiting-for-requester, waiting-for-admin, in-progress, completed, cancelled. Adapt to existing enums without losing historical semantics. Approval alone never means provisioned. Create jobs only after every required approval stage succeeds. Define server-enforced transitions, reopen behavior and evidence requirements.

Add private admin notes, employee-visible replies, checklist templates and instantiated checklist tasks with owner, due date, status, and completion evidence. Snapshot instantiated checklists so template edits do not rewrite existing work. Keep optional and required tasks distinct; a parent cannot complete while required tasks remain unresolved.

For manual access completion/removal, require who performed it, when, the provider/target, verification method and explanatory evidence. Record the authenticated confirmer separately from a claimed external performer. Label it manually confirmed, never provider verified.

Add saved views and server-side filters for mine, unassigned, overdue, waiting-for-admin, expiring access and failed workflows. Deduplicate durable reminders and escalation notifications. User-visible delivery states must distinguish queued, sent, failed and unconfigured. Use existing notification transport; no live emails during tests.

### 2. Six end-to-end use cases

Onboarding: assigned checklist covering documents, tools, identity and optional mailbox readiness; employee sees only their own permitted tasks.

Software access: employee selects application/project and reason; existing approvers decide; fulfillment tracks manual action or the configured Microsoft action; completion records evidence.

Equipment/documents: assign responsibility, exchange employee-visible replies and private attachments, record delivery/return. Do not turn this into a purchasing or HR-document-generation system.

Contractors: require an expiry for temporary access, schedule removal using existing grants/jobs, remind the owner, and show overdue/unverified removal until removal is confirmed. Expiry is not evidence of revocation.

QA: request a staging account linked to a test environment, assign a tester and fulfillment owner, share only employee-authorized environment/account metadata. Keep the full account directory admin-only. Never store passwords or expose another tester's account; retain password-manager links only under explicit server-side authorization. Archive is not external revocation. Link an issue/environment when useful; existing issue-reading integrations do not create tickets or provision users.

Offboarding: disable local access when due, contain configured external access, revoke sessions, track group removal, equipment return, handover and data/mailbox preservation. Block license reclamation until required preservation tasks have explicit evidence. Leave unsupported operations manual-required. Never delete mailboxes, users or files automatically. Do not claim session revocation instantly terminates every existing provider access token.

### 3. Persistence, files and worker hardening

Introduce record-level repositories, company-scoped SQL pagination and appropriate indexes for pilot lists, request conversations/tasks, evidence, notifications, audit and jobs. Preserve existing IDs and history with versioned migrations and backfills. Avoid whole-workspace reads on these routes and avoid whole-workspace writes overwriting migrated records. Document remaining legacy paths. Add concurrency protection and transactional state+audit/outbox writes. A browser-side slice of a whole workspace is not database pagination.

Move attachment bytes out of workspace JSON to private storage using a storage abstraction. Prefer a private disk implementation compatible with existing VPS deployment plus a future object-store adapter boundary. Use opaque keys, authenticated short-lived signed download URLs bound to the intended company/session, authorization at download time, safe download headers, limits and content validation. No public files or permanent bearer URLs. Migrate legacy attachments without data loss; make backfill restartable and include files in backup/restore procedures.

Extend the existing PostgreSQL worker. Implement paginated dispatch beyond the 500-company cap, bounded batches, transactional claims, lease ownership checks, recovery after process death, capped jittered retries honoring provider Retry-After, and explicit permanent/manual errors. Persist stable operation keys and perform read-after-write reconciliation when a provider operation may have succeeded before the worker crashed. Do not assume exactly-once external execution or classify all HTTP 400 responses as success.

### 4. Microsoft readiness and one verified action

Keep consent state bound to user/company/Microsoft tenant, single-use and expiring; mark connected only after token/required-capability validation. Distinguish Neutronium company ID from Microsoft tenant ID throughout. Feature toggles restrict execution, not Microsoft's actual consent grant. Check both permissions and enabled features at execution. Keep tenant/app/resource token caches isolated and secrets server-side.

Add validated ISO country `usageLocation` separately from city. Add verified-domain selection, deterministic email suggestion with explicit override and collision handling, available SKU/service-plan selection, and preflight errors. Never adopt an existing identity just because its email matches. Preserve existing workflow-marker ownership checks and explicit account matching. Do not add every permission suggested in the draft; document the least permission needed for each implemented endpoint and consent boundary.

First verified action: approved addition of an explicitly matched employee to a configured, supported Microsoft security group. Extend the existing implementation. Validate group type and target, respect existing approval stages, reject privileged/unsupported groups, execute idempotently, read membership back, and persist verification evidence. Handle pre-existing untracked membership as review-required rather than silently claiming ownership. Expiry/removal must likewise read back and verify absence. A failed or incomplete read never proves removal.

Add paginated read-only inventory/reconciliation for configured Microsoft identities and entitlements. Store sync runs, last attempt, last successful complete sync, coverage, errors and stable provider IDs. Distinguish directory-only, manually confirmed, provider-verified, stale and unknown evidence. Report unexpected access, missing expected access and overdue removals. Partial/failed syncs must preserve prior evidence and must not generate false absence or removal findings. No automatic drift remediation in this milestone.

### 5. Email readiness as part of onboarding

Add a company email readiness view and manual DNS record pack for an existing customer domain. Show domain verification, Exchange-capable license/service-plan status, provisioning pending, mailbox verification evidence, and outstanding setup tasks. Pull actual tenant-specific DNS records where supported; otherwise request admin-supplied values and mark them unverified. Never manufacture DKIM targets or overwrite existing SPF/MX records.

Keep identity-created, license-assigned, mailbox-pending and mailbox-verified distinct. License assignment alone must not mark email ready. Use a documented supported verification mechanism with minimum permissions; if none is available under current consent, require explicitly labeled manual mailbox verification. Bound polling and surface provisioning errors/timeouts. Do not read mail content just to verify readiness. Portal invites and company mailbox readiness are independent checklist steps.

DKIM enablement and shared-mailbox management require verified Exchange-supported operations, not invented Graph endpoints. For this milestone keep them manual tasks where the adapter does not support them. Do not turn a valid domain or a UPN into proof that mail delivery works.

### 6. Pilot security and measurement

Implement admin MFA enrollment/challenge/recovery using a maintained, reviewed mechanism, hashed single-use recovery codes, rate limiting and audited reset/recovery. Enforce MFA on privileged sessions/API operations; social sign-in alone is not proof of MFA. Add session listing/revocation while preserving password-change and due-offboarding invalidation. Do not strand existing owners during migration: document and test an enrollment-required transition.

Verify authorization through the actual runtime database role; RLS enabled on tables is not proof of isolation if the application connects as an owner/bypass role. Test company and record boundaries in APIs, worker claims, evidence, attachments and credentials. Document database/file/key backups and exercise restore into an isolated local/test destination without overwriting live data.

Add a simple pilot report from persisted events: overdue open requests, completion duration, removals due but not verified, and repeated manual action categories. Include time window, counts and manual/provider verification breakdowns; no fabricated sample metrics in production. The one-month pilot itself is an external outcome, not something code/tests can claim to have completed.

## Corrections to the drafts

- Provider mutations are side effects; durable, retry-safe steps are not pure functions.
- Certificates with exportable private keys are still exfiltratable secrets. Protect and rotate them; never copy illustrative credential snippets from the drafts.
- Graph app consent, CSP reseller relationships and GDAP delegation are separate mechanisms. CSP is not needed for this pilot.
- The statement that indirect resale has no revenue floor is incorrect as an ongoing eligibility claim: Microsoft lists a USD 1,000 trailing-12-month annual requirement. Do not implement billing based on the draft's price table.
- Shared-mailbox licensing depends on size and features such as hold/archive; conversion is not blanket permission to remove a license.
- Do not implement worksheet/column confidentiality with Excel hiding/protection or assume Purview creates per-column ACLs. Use separately permissioned files where needed in a later scope.
- A generic SCIM client is not universal compatibility. Provider plans, schemas and behaviors differ. GitHub/Jira issue APIs do not establish provisioning capability.

Verified references to revisit for endpoint-specific implementation:

- https://learn.microsoft.com/en-us/graph/api/user-post-users?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/user-assignlicense?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure
- https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes?view=o365-worldwide
- https://learn.microsoft.com/en-us/partner-center/enroll/indirect-reseller-eligibility-requirements

## Acceptance and delivery

Add meaningful automated tests for all six flows, server-side role/company boundaries, self-approval protection, internal-note privacy, attachment isolation/expiry, migration/backfill preservation, concurrent updates, worker crash recovery after provider success, duplicate scheduling, Microsoft throttling, partial reconciliation and preservation-before-license-removal. Use provider mocks and explicit development simulation; never report simulated execution as live verification.

Run `npm run test:neutronium`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the Neutronium Playwright suite with a server on the configured port. Inspect changed desktop/mobile flows. Fix regressions; distinguish pre-existing failures and unavailable external checks.

Provide changed files, applied design decisions, migrations/backfill/rollback instructions, actual check results, required environment settings without secret values, and a disposable-tenant validation runbook. Maintain a milestone checklist showing complete, partial and externally unverified items. If credentials are unavailable, complete local implementation/testing and accurately identify live verification still needed. Do not call the result production-ready merely because the demo passes.
