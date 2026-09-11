# Employee intake and portal fixes — local release candidate

These changes have not been deployed. Production was inspected read-only for the reported university email issue; no real email was sent or link consumed.

## Behavior

- The company switcher opens workspace navigation and lists the signed-in user's other memberships. The avatar and an explicit My profile navigation item open account settings.
- The dashboard's attention area includes employee applications, access requests, workflow failures/manual actions, and employee help. Application rows link directly to the correct application and company, including after sign-in.
- People combines applications and existing employees in a sortable table. Search covers stored details; filters cover source, status, department/team, manager, and start-date range. Approved employees appear once. Application completion follows successful onboarding; employment status remains visible.
- Applications have Needs review, In review, Pending information, Approved / processing, Processed / complete, and Declined display states. Completion is derived from the linked workflow.
- Employees can view and edit their own pending application through the original invitation, including after the invitation expires or is revoked. Edits return it to Needs review. Submitted records remain unavailable to other applicants.
- HR/admin can correct application details and stage reviews. Only company owner/admin roles can accept or decline. HR manual intake submits to the review queue. Optimistic revisions prevent stale edits or decisions; acceptance remains transactional.
- Employee intake uses company-derived choices for teams, titles, and locations when available, with fixed employment type/work arrangement/country selections. Uncertain employees can leave choices for the administrator. Admin editing supports new team, title, and location values.
- Existing employee details can be corrected in People. Reporting managers are active employee records assigned in Edit employee details. Manager portal privileges are assigned separately in Employee portal access; changing an accepted employee's role reuses their existing membership, including when their login and work addresses differ.
- Current sessions use Sign out, while other sessions retain Revoke session. Workflow claiming and manual completion block unresolved predecessors, and waiting steps explain their dependency.

## University email finding

The production database contained one `@mail.utoronto.ca` account: verified, with the admin signup role and no outstanding confirmation tokens. Existing signup code silently skipped sending when an account was already verified but still instructed the user to check email. New code recognizes a verified account after checking its password and directs the user to sign in. Unverified accounts have a rate-limited resend action that preserves employee invitation return paths.

Production uses Cloudflare REST email. The mailer now checks response acknowledgement and immediate bounce/suppression results instead of treating every HTTP 200 as a send. This does not prove inbox placement. No fresh live-provider delivery has been attempted. Reference: https://developers.cloudflare.com/api/resources/email_sending/methods/send/

## Migration and eventual release

Migration `008_application_review.sql` is required after 007 and before starting this app. It extends review statuses, adds revision checks and manual-entry contact identity, preserves existing records, and retains the existing tenant policies. Fresh installations run it through the mounted migrations directory.

Follow AGENTS.md only after an explicit deployment request. Back up the matched database and private files and archive the prior source first. Upload only reviewed Neutronium files; preserve unrelated project edits and secrets. Migration 008 is transactional and must not be blindly repeated. A release guard can inspect the three added columns and three named constraints:

```sql
select
 (select count(*) from information_schema.columns
  where table_schema='public' and table_name='neutronium_employee_applications'
    and column_name in ('contact_email','revision','submitted_by'))
 +
 (select count(*) from pg_constraint
  where conrelid='neutronium_employee_applications'::regclass
    and conname in ('neutronium_application_status','neutronium_application_identity','neutronium_application_decision')) as migration_008_state;
```

0 means absent: apply 008 once after backup. 6 means applied: skip it. Any other result requires inspection. Restore the matched pre-migration backup if rolling the release back; do not assume the old code supports new review states.

## Validation

All local checks passed: 61 unit/database tests, 13 targeted browser tests, `npx tsc --noEmit`, `npm run lint` (no warnings/errors), and `npm run build`. Desktop application review, People table, profile navigation, and mobile intake screenshots were inspected. The temporary preview server was stopped and its generated build directory removed. Database tests exercise tenant isolation, applicant ownership, role restrictions, revision conflicts, atomic acceptance, manual intake, direct notification links, table filters, duplicate prevention, and workflow-derived completion. Browser tests use synthetic accounts and mocked email/provider boundaries.


Preview captures: `.neutronium-dev/review-application-desktop.png`, `.neutronium-dev/review-people-desktop.png`, `.neutronium-dev/review-profile-desktop.png`, and `.neutronium-dev/review-intake-mobile.png`. These contain synthetic test data.
