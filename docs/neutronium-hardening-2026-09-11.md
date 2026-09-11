# Neutronium interaction and security hardening

Local review and implementation, September 11, 2026. No VPS upload, migration, deployment, or live provider actions were performed. The previous move of Test environments into Apps is retained. Unrelated PulseDeals changes were preserved.

## Fixes

| Area | Result |
| --- | --- |
| Secondary controls | Sign-out, session revocation, notification retries, mark-as-read, provider linking, company inspection, and attachment downloads now handle failures or block overlapping actions. Error and success dismiss buttons remain usable. |
| Forms | Workspace, service inbox, connection, and mailbox forms use accessible field validation. Empty or whitespace-only required fields, unchecked required checkboxes, invalid selections, text length limits, unsafe links, and unsupported control characters are checked. Failed saves preserve entered values. |
| Repeated actions | Identical requests already in flight share one network request. Workspace mutations and security actions have immediate guards, beyond the visual disabled state. Writes are never automatically retried. |
| Refreshes | Requests have timeouts; HTTP 429 responses include Retry-After, and the client respects it. Older snapshots cannot replace a newer workspace response. A refresh after saving starts a fresh read, and a successful save remains successful even when that read fails. Hidden tabs pause workspace polling. |
| Sessions | Background 401/403 responses clear the displayed workspace. Sign-out expires the demo cookie at its actual /neutronium path and no longer reports success when server session revocation fails. MFA-gate sign-out errors are visible and retryable. |
| Company selection | Service requests, related workflow context, and pilot reports explicitly include the selected organization. |
| Server input | JSON bodies are read with a 100,000-byte streaming limit, including UTF-8 byte accounting and upload cancellation at the limit. Invalid JSON, non-object bodies, excessive nesting, unsafe object property names, and unsupported control characters receive controlled errors. |
| Domain validation | Strict UUIDs, real calendar dates, numeric access durations, employee import record shapes, account types, and credential-free HTTPS directory URLs are checked. Spreadsheet export also protects formula prefixes following leading whitespace. |
| Request limits | Existing database-backed authentication and mutation limits now also cover reads, public request bursts, provider synchronization, and invitations. Limiter failures reject requests with an availability error. Workspace creation also enforces an existing MFA requirement. |
| Dependencies | Next.js and its lint configuration are updated to 15.5.25; PostCSS and Sharp use patched versions. Compatible build-tool dependency updates remove the remaining reported advisories. The lockfile records the exact versions, including Wrangler 4.131.0. |

User-entered prose remains text: legitimate names and notes are not destructively stripped of punctuation or markup-looking characters. React escapes their rendered content, SQL uses parameters, and links have scheme/credential validation. A browser regression verifies that an HTML-looking environment name is displayed literally without executing it.

Existing security regression coverage also checks role permissions, tenant-scoped reads/writes and PostgreSQL RLS, CSRF rejection, cross-tenant record IDs, approval/self-approval policy, token verification, MFA replay/recovery behavior, encrypted tenant-bound credentials, private-file tickets, and worker leases.

## Validation

- Neutronium backend/unit suite: 71 tests passed, including the final UUID/input checks and concurrent database limiter test.
- Full Neutronium browser suite: 31 scenarios passed. Coverage includes navigation, mobile menus, dialogs, onboarding, employee approvals, access requests, offboarding, help attachments, exports, account security, secondary controls, repeated submissions, expired sessions, and failed reads/writes.
- Additional focused authentication/security rerun: 12 browser scenarios passed after the final input checks.
- PulseDeals and Local Lore unit suites passed after the shared dependency updates.
- Local production startup smoke passed: demo disabled, the bare Neutronium URL redirected while preserving its query, and frame/content-type protection headers were present.
- Lint, TypeScript, and the production build passed. The final full npm audit reports zero known vulnerabilities, including development dependencies.

The dependency scan initially reported four affected runtime packages, including a critical Next.js advisory. The framework update addresses the maintainer's [image-optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4); Sharp 0.35.4 addresses its [libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c). Next.js 15 still pins an older PostCSS, so the manifest explicitly overrides that nested dependency with the patched PostCSS 8 version. Its Sharp override also prevents selection of the older vulnerable alternative.

## Scope of verification

Browser tests run locally using development workspaces or mocked APIs. Database tests use embedded PostgreSQL, including a 30-request limiter burst that permits only the configured five requests. These results do not assert live Microsoft consent, email delivery, customer workflows, or deployed proxy behavior. Request limits rely on the existing production Caddy configuration overwriting forwarded client IP headers. A production rollout and its live checks require a separate explicit deployment request.

Duplicate protection covers overlapping client submissions and existing domain protections; it is not a new durable, cross-device idempotency system for every command. After a network timeout with an uncertain outcome, the interface instructs the user to refresh and inspect the result before submitting again. Zero reported dependency advisories is a dated scan result, not a claim of complete security.
